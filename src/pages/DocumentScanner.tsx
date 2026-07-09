import { useCallback, useEffect, useRef, useState } from 'react';
import { PremiumPageHeader } from '../components/ui/PremiumPageHeader';
import { PageShell } from '../components/ui/PageShell';
import {
  Camera,
  CameraOff,
  FileSearch,
  Keyboard,
  Loader2,
  QrCode,
  RefreshCw,
  ScanLine,
  ShieldCheck,
} from 'lucide-react';
import { DocumentVerificationResultCard } from '../components/documents/DocumentVerificationResultCard';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../hooks/useToast';
import {
  extractVerificationInput,
  type DocumentVerificationResult,
  verifyDocumentReference,
  verifyDocumentToken,
} from '../services/documentVerification';
import jsQR from 'jsqr';

type BarcodeDetectorShape = {
  detect(video: HTMLVideoElement): Promise<Array<{ rawValue?: string }>>;
};

type BarcodeDetectorConstructor = new (options?: { formats?: string[] }) => BarcodeDetectorShape;

declare global {
  interface Window {
    BarcodeDetector?: BarcodeDetectorConstructor;
  }
}

function stopStream(stream: MediaStream | null) {
  stream?.getTracks().forEach((track) => track.stop());
}

export function DocumentScanner() {
  const { profile } = useAuth();
  const toast = useToast();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const frameRef = useRef<number | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scanningRef = useRef(false);
  const manualInputRef = useRef<HTMLInputElement | null>(null);

  const [manualValue, setManualValue] = useState('');
  const [cameraStatus, setCameraStatus] = useState<'idle' | 'starting' | 'active' | 'unsupported' | 'denied' | 'error'>('idle');
  const [verifying, setVerifying] = useState(false);
  const [lastInput, setLastInput] = useState('');
  const [result, setResult] = useState<DocumentVerificationResult | null>(null);

  const stopCamera = useCallback(() => {
    scanningRef.current = false;
    if (frameRef.current !== null) {
      window.cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
    }
    stopStream(streamRef.current);
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setCameraStatus((status) => (status === 'active' || status === 'starting' ? 'idle' : status));
  }, []);

  const verifyValue = useCallback(async (rawValue: string) => {
    const value = rawValue.trim();
    if (!value) {
      toast.warning('Saisissez une référence ou scannez un QR code.');
      return;
    }

    setLastInput(value);
    setVerifying(true);
    try {
      const parsed = extractVerificationInput(value);
      const next = parsed.token
        ? await verifyDocumentToken(parsed.token, { reference: parsed.reference, type: null })
        : await verifyDocumentReference(parsed.reference ?? value, profile?.agency_id);
      setResult(next);
      if (next.state === 'authentic') {
        toast.success(parsed.token ? 'Document authentique' : 'Preuve trouvée dans votre coffre');
      } else if (next.state === 'network_error') {
        toast.error('Vérification impossible pour le moment');
      }
    } finally {
      setVerifying(false);
    }
  }, [profile?.agency_id, toast]);

  const startCamera = useCallback(async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraStatus('unsupported');
      return;
    }

    setCameraStatus('starting');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.setAttribute('playsinline', 'true'); // indispensable sur iPhone/Safari
        await videoRef.current.play();
      }

      const detector = window.BarcodeDetector ? new window.BarcodeDetector({ formats: ['qr_code'] }) : null;
      scanningRef.current = true;
      setCameraStatus('active');

      const scanFrame = async () => {
        if (!scanningRef.current || !videoRef.current) return;
        try {
          if (detector) {
            const codes = await detector.detect(videoRef.current);
            const rawValue = codes[0]?.rawValue;
            if (rawValue) {
              stopCamera();
              await verifyValue(rawValue);
              return;
            }
          } else {
            // Fallback universel jsQR (iPhone / Safari / Firefox)
            const video = videoRef.current;
            if (video.readyState === video.HAVE_ENOUGH_DATA && video.videoWidth > 0) {
              if (!canvasRef.current) {
                canvasRef.current = document.createElement('canvas');
              }
              const canvas = canvasRef.current;
              canvas.width = video.videoWidth;
              canvas.height = video.videoHeight;
              const ctx = canvas.getContext('2d', { willReadFrequently: true });
              if (ctx) {
                ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
                const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                const code = jsQR(imageData.data, imageData.width, imageData.height, {
                  inversionAttempts: 'dontInvert',
                });
                if (code?.data) {
                  stopCamera();
                  await verifyValue(code.data);
                  return;
                }
              }
            }
          }
        } catch {
          // Retry next frame
        }
        frameRef.current = window.requestAnimationFrame(scanFrame);
      };

      frameRef.current = window.requestAnimationFrame(scanFrame);
    } catch (error) {
      stopCamera();
      const message = error instanceof DOMException ? error.name : '';
      setCameraStatus(message === 'NotAllowedError' ? 'denied' : 'error');
    }
  }, [stopCamera, verifyValue]);

  useEffect(() => () => stopCamera(), [stopCamera]);

  const resetScanner = useCallback(() => {
    stopCamera();
    setCameraStatus('idle');
    setResult(null);
    setManualValue('');
    setLastInput('');
  }, [stopCamera]);

  const focusManualInput = () => {
    manualInputRef.current?.focus();
    manualInputRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  const cameraMessage = {
    idle: 'Activez la caméra pour scanner le QR code imprimé sur un document Samay Këur.',
    starting: 'Ouverture de la caméra...',
    active: 'Placez le QR code dans le cadre. La vérification démarre automatiquement.',
    unsupported: "Le scan caméra n'est pas disponible dans ce navigateur. Utilisez la saisie manuelle.",
    denied: "L'accès caméra est refusé. Autorisez la caméra ou utilisez la saisie manuelle.",
    error: 'Impossible d’ouvrir la caméra. Utilisez la saisie manuelle.',
  }[cameraStatus];

  return (
    <PageShell spacing="standard" variant="dataDense" tone="paper" verticalInset="standard" className="pb-24 lg:pb-2" ariaLabel="Scanner documentaire">
      <PremiumPageHeader
        variant="registry"
        density="compact"
        className="lg:!flex-row lg:!items-center lg:!justify-between"
        eyebrow="REGISTRE DOCUMENTAIRE"
        title="Scanner un document"
        description="Scannez le QR d'une quittance, d'un contrat ou d'un rapport pour confirmer son authenticité."
        mobileDescription="Vérification QR."
        sideContent={
          <div className="hidden max-w-[17.5rem] items-center gap-2 rounded-xl border border-emerald-950/10 bg-white/70 px-2.5 py-2 text-[0.68rem] font-semibold leading-4 text-slate-600 shadow-sm ring-1 ring-white/70 lg:flex">
            <ShieldCheck className="h-3.5 w-3.5 flex-shrink-0 text-emerald-700" />
            Seules les informations publiques nécessaires au contrôle sont affichées.
          </div>
        }
      />

      <div className="grid min-w-0 max-w-full gap-3 sm:gap-4 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1fr)]">
        <section className="min-w-0 max-w-full space-y-3">
          <div className="min-w-0 max-w-full overflow-hidden rounded-[1.2rem] border border-emerald-950/10 bg-[linear-gradient(135deg,rgba(255,252,245,0.96),rgba(255,255,255,0.92))] p-3 shadow-[0_12px_30px_rgba(15,23,42,0.055)] ring-1 ring-white/70 sm:p-3.5">
            <div className="flex min-w-0 items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[0.58rem] font-black uppercase tracking-[0.16em] text-emerald-700">Caméra</p>
                <h2 className="mt-0.5 text-sm font-extrabold text-slate-950 sm:text-base">Scan QR sécurisé</h2>
                <p className="mt-1 line-clamp-2 text-[0.72rem] font-medium leading-5 text-slate-500 sm:text-xs">{cameraMessage}</p>
              </div>
              <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-xl border border-emerald-950/10 bg-white/70 text-emerald-800 ring-1 ring-white/70">
                <QrCode className="h-4 w-4" />
              </div>
            </div>

            <div className="relative mt-2.5 h-[8.75rem] w-full max-w-full overflow-hidden rounded-xl border border-emerald-950/10 bg-slate-950 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] sm:h-[11rem] lg:h-[11.75rem]">
              <video ref={videoRef} className="h-full w-full object-cover" muted playsInline />
              {cameraStatus !== 'active' && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-[radial-gradient(circle_at_50%_15%,#153f34_0%,#071713_55%,#020807_100%)] px-4 text-center text-white">
                  {cameraStatus === 'starting' ? (
                    <Loader2 className="h-6 w-6 animate-spin text-emerald-200" />
                  ) : cameraStatus === 'unsupported' || cameraStatus === 'denied' || cameraStatus === 'error' ? (
                    <CameraOff className="h-6 w-6 text-amber-200" />
                  ) : (
                    <Camera className="h-6 w-6 text-emerald-200" />
                  )}
                  <p className="mt-2 max-w-[15rem] text-[0.68rem] font-medium leading-4 text-emerald-50/75 sm:text-[0.72rem] sm:leading-5">{cameraMessage}</p>
                  {cameraStatus !== 'starting' && (
                    <div className="mt-2.5 flex max-w-full flex-wrap justify-center gap-2">
                      {cameraStatus !== 'unsupported' && (
                        <button type="button" onClick={startCamera} className="sk-action sk-action-primary h-7 justify-center px-2.5 py-1 text-[0.68rem] sm:h-8 sm:text-[0.72rem]">
                          <Camera className="h-3.5 w-3.5" />
                          {cameraStatus === 'idle' ? 'Ouvrir la caméra' : 'Réessayer'}
                        </button>
                      )}
                      <button type="button" onClick={focusManualInput} className="sk-action h-7 border-white/20 bg-white/10 px-2.5 py-1 text-[0.68rem] text-white hover:bg-white/15 sm:h-8 sm:text-[0.72rem]">
                        <Keyboard className="h-3.5 w-3.5" />
                        Coller une référence
                      </button>
                    </div>
                  )}
                </div>
              )}
              {cameraStatus === 'active' && (
                <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                  <div className="relative h-28 w-28 rounded-2xl border border-emerald-200 shadow-[0_0_0_999px_rgba(2,6,23,0.35)] sm:h-36 sm:w-36">
                    <ScanLine className="absolute left-1/2 top-1/2 h-7 w-7 -translate-x-1/2 -translate-y-1/2 text-orange-200" />
                  </div>
                </div>
              )}
            </div>

            {cameraStatus === 'active' && (
              <div className="mt-3 flex min-w-0 gap-2">
                <button type="button" onClick={stopCamera} className="sk-action sk-action-secondary h-8 min-w-0 justify-center px-2 text-[0.72rem]">
                  <CameraOff className="h-3.5 w-3.5" />
                  Arrêter
                </button>
                <button
                  type="button"
                  onClick={resetScanner}
                  className="sk-action sk-action-secondary h-8 min-w-0 justify-center px-2 text-[0.72rem]"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  Scanner un autre document
                </button>
              </div>
            )}
          </div>

          <form
            className="min-w-0 max-w-full rounded-[1.2rem] border border-emerald-950/10 bg-[linear-gradient(135deg,rgba(255,252,245,0.96),rgba(255,255,255,0.92))] p-3 shadow-[0_12px_30px_rgba(15,23,42,0.055)] ring-1 ring-white/70 sm:p-3.5"
            onSubmit={(event) => {
              event.preventDefault();
              void verifyValue(manualValue);
            }}
          >
            <div className="flex items-start gap-2.5">
              <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-xl border border-emerald-950/10 bg-white/70 text-emerald-800 ring-1 ring-white/70">
                <Keyboard className="h-4 w-4" />
              </div>
              <div>
                <p className="text-[0.58rem] font-black uppercase tracking-[0.16em] text-emerald-700">Saisie manuelle</p>
                <h2 className="mt-0.5 text-sm font-extrabold text-slate-950">Coller un QR ou une référence</h2>
                <p className="mt-1 hidden text-xs font-medium leading-5 text-slate-500 sm:block">
                  Collez l’URL du QR, le jeton sécurisé ou la référence imprimée sur le document.
                </p>
              </div>
            </div>
            <div className="mt-3 flex min-w-0 flex-col gap-2 sm:flex-row">
              <input
                ref={manualInputRef}
                value={manualValue}
                onChange={(event) => setManualValue(event.target.value)}
                placeholder="Ex : QIT-2026-05-ABC123 ou URL de vérification"
                className="h-9 min-w-0 max-w-full flex-1 rounded-[0.65rem] border border-emerald-950/10 bg-white/95 px-3 py-0 text-xs font-medium text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-emerald-700 focus:ring-4 focus:ring-emerald-900/10 sm:h-10 sm:text-[0.82rem]"
              />
              <button type="submit" disabled={verifying} className="sk-action sk-action-primary h-9 justify-center px-3 text-[0.72rem] disabled:opacity-60 sm:h-10">
                {verifying ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileSearch className="h-3.5 w-3.5" />}
                Vérifier
              </button>
            </div>
            <p className="mt-1.5 text-[0.68rem] font-medium leading-4 text-slate-500">
              Utilisez la référence imprimée ou l’URL complète contenue dans le QR code.
            </p>
          </form>
        </section>

        <section className="min-w-0 max-w-full pb-2 sm:pb-0">
          {result || verifying ? (
            <DocumentVerificationResultCard
              result={result}
              loading={verifying}
              onRetry={lastInput ? () => void verifyValue(lastInput) : undefined}
              onReset={resetScanner}
              compact
              showBrand={false}
            />
          ) : (
            <div className="flex min-h-[8.75rem] max-w-full flex-col items-center justify-center rounded-[1.2rem] border border-emerald-950/10 bg-white/80 p-3.5 text-center shadow-[0_12px_30px_rgba(15,23,42,0.055)] ring-1 ring-white/70 sm:min-h-[11rem] sm:p-4 lg:min-h-[12rem]">
              <div className="flex h-9 w-9 items-center justify-center rounded-2xl border border-emerald-950/10 bg-emerald-50/80 text-emerald-800 ring-1 ring-white/70 sm:h-10 sm:w-10">
                <ShieldCheck className="h-4 w-4 sm:h-5 sm:w-5" />
              </div>
              <h2 className="mt-2 text-sm font-extrabold text-slate-950 sm:text-base">Résultat de vérification</h2>
              <p className="mt-1.5 max-w-md text-[0.72rem] font-medium leading-5 text-slate-500 sm:text-xs">
                Le statut du document apparaîtra ici : authentique, introuvable, révoqué ou erreur réseau.
              </p>
            </div>
          )}
        </section>
      </div>
    </PageShell>
  );
}
