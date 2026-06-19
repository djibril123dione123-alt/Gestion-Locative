import { useCallback, useEffect, useRef, useState } from 'react';
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
  const frameRef = useRef<number | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scanningRef = useRef(false);

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
        toast.success('Document authentique');
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
    if (!window.BarcodeDetector) {
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
        await videoRef.current.play();
      }

      const detector = new window.BarcodeDetector({ formats: ['qr_code'] });
      scanningRef.current = true;
      setCameraStatus('active');

      const scanFrame = async () => {
        if (!scanningRef.current || !videoRef.current) return;
        try {
          const codes = await detector.detect(videoRef.current);
          const rawValue = codes[0]?.rawValue;
          if (rawValue) {
            stopCamera();
            await verifyValue(rawValue);
            return;
          }
        } catch {
          // Some browsers can fail while the video is warming up; retry next frame.
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

  const cameraMessage = {
    idle: 'Activez la caméra pour scanner le QR code imprimé sur un document Samay Këur.',
    starting: 'Ouverture de la caméra...',
    active: 'Placez le QR code dans le cadre. La vérification démarre automatiquement.',
    unsupported: "Le scan caméra n'est pas disponible dans ce navigateur. Utilisez la saisie manuelle.",
    denied: "L'accès caméra est refusé. Autorisez la caméra ou utilisez la saisie manuelle.",
    error: 'Impossible d’ouvrir la caméra. Utilisez la saisie manuelle.',
  }[cameraStatus];

  return (
    <div className="sk-mobile-page min-w-0 space-y-3.5 sm:space-y-5">
      <div className="sk-mobile-hero max-w-full overflow-hidden bg-gradient-to-br from-emerald-950 via-emerald-900 to-slate-950 p-3.5 text-white shadow-2xl shadow-emerald-950/15 sm:p-6">
        <div className="absolute -right-20 -top-20 hidden h-56 w-56 rounded-full bg-orange-300/15 blur-3xl sm:block" />
        <div className="relative flex min-w-0 flex-col gap-3 sm:gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0 max-w-2xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.08] px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-emerald-100">
              <ShieldCheck className="h-3.5 w-3.5 text-orange-200" />
              Vérification documentaire
            </div>
            <h1 className="mt-2.5 text-2xl font-extrabold tracking-tight sm:mt-4 sm:text-4xl">Scanner un document</h1>
            <p className="mt-1.5 max-w-xl text-sm font-medium leading-5 text-emerald-50/75 sm:mt-2 sm:text-base sm:leading-6">
              <span className="sm:hidden">Scannez un QR pour vérifier un document Samay Këur.</span>
              <span className="hidden sm:inline">Scannez le QR d’une quittance, facture, contrat, mandat ou rapport pour confirmer son authenticité sans quitter l’application.</span>
            </p>
          </div>
          <div className="hidden rounded-2xl border border-white/10 bg-white/[0.08] p-4 text-sm font-semibold text-emerald-50/75 backdrop-blur sm:block lg:max-w-xs">
            Les données affichées doivent correspondre au document scanné. En cas d’écart, contactez l’émetteur.
          </div>
        </div>
      </div>

      <div className="grid min-w-0 max-w-full gap-3.5 sm:gap-5 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
        <section className="min-w-0 max-w-full space-y-3 sm:space-y-4">
          <div className="sk-premium-panel min-w-0 max-w-full overflow-hidden p-3 sm:p-4">
            <div className="flex min-w-0 items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs font-black uppercase tracking-[0.12em] text-emerald-700">Caméra</p>
                <h2 className="mt-0.5 text-lg font-black text-slate-950 sm:mt-1 sm:text-xl">Scan QR sécurisé</h2>
                <p className="mt-1 line-clamp-2 text-xs font-semibold leading-5 text-slate-500 sm:mt-2 sm:text-sm sm:leading-6">{cameraMessage}</p>
              </div>
              <QrCode className="h-6 w-6 text-emerald-800" />
            </div>

            <div className="relative mt-3 aspect-[16/10] max-h-[15rem] w-full max-w-full overflow-hidden rounded-xl border border-emerald-950/10 bg-slate-950 sm:mt-4 sm:aspect-[4/3] sm:max-h-none sm:rounded-[1.35rem]">
              <video ref={videoRef} className="h-full w-full object-cover" muted playsInline />
              {cameraStatus !== 'active' && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950 text-center text-white">
                  {cameraStatus === 'starting' ? (
                    <Loader2 className="h-10 w-10 animate-spin text-emerald-200" />
                  ) : cameraStatus === 'unsupported' || cameraStatus === 'denied' || cameraStatus === 'error' ? (
                    <CameraOff className="h-10 w-10 text-orange-200" />
                  ) : (
                    <Camera className="h-10 w-10 text-emerald-200" />
                  )}
                  <p className="mt-3 max-w-xs px-4 text-sm font-semibold text-emerald-50/70">{cameraMessage}</p>
                </div>
              )}
              {cameraStatus === 'active' && (
                <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                  <div className="relative h-36 w-36 rounded-2xl border-2 border-emerald-200 shadow-[0_0_0_999px_rgba(2,6,23,0.35)] sm:h-48 sm:w-48 sm:rounded-3xl">
                    <ScanLine className="absolute left-1/2 top-1/2 h-10 w-10 -translate-x-1/2 -translate-y-1/2 text-orange-200" />
                  </div>
                </div>
              )}
            </div>

            <div className="mt-3 grid min-w-0 grid-cols-2 gap-2 sm:mt-4 sm:flex sm:flex-row">
              {cameraStatus === 'active' ? (
                <button type="button" onClick={stopCamera} className="sk-action sk-action-secondary min-w-0 justify-center px-2">
                  <CameraOff className="h-4 w-4" />
                  Arrêter
                </button>
              ) : (
                <button type="button" onClick={startCamera} className="sk-action sk-action-primary min-w-0 justify-center px-2">
                  <Camera className="h-4 w-4" />
                  Ouvrir la caméra
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  setResult(null);
                  setManualValue('');
                  setLastInput('');
                }}
                className="sk-action sk-action-secondary min-w-0 justify-center px-2"
              >
                <RefreshCw className="h-4 w-4" />
                Scanner un autre document
              </button>
            </div>
          </div>

          <form
            className="sk-premium-panel min-w-0 max-w-full p-3 sm:p-4"
            onSubmit={(event) => {
              event.preventDefault();
              void verifyValue(manualValue);
            }}
          >
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-800 ring-1 ring-emerald-950/10 sm:h-11 sm:w-11 sm:rounded-2xl">
                <Keyboard className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs font-black uppercase tracking-[0.12em] text-emerald-700">Saisie manuelle</p>
                <h2 className="mt-0.5 text-base font-black text-slate-950 sm:mt-1 sm:text-lg">Coller un QR ou une référence</h2>
                <p className="mt-1 hidden text-sm font-semibold leading-5 text-slate-500 sm:block">
                  Collez l’URL du QR, le jeton sécurisé ou la référence imprimée sur le document.
                </p>
              </div>
            </div>
            <div className="mt-3 flex min-w-0 flex-col gap-2 sm:mt-4 sm:flex-row">
              <input
                value={manualValue}
                onChange={(event) => setManualValue(event.target.value)}
                placeholder="Ex : QL-2026-05-ABC123 ou URL de vérification"
                className="min-h-11 min-w-0 max-w-full flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold outline-none transition focus:border-emerald-700 focus:ring-4 focus:ring-emerald-900/10 sm:min-h-12 sm:rounded-2xl sm:px-4 sm:py-3"
              />
              <button type="submit" disabled={verifying} className="sk-action sk-action-financial justify-center disabled:opacity-60">
                {verifying ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileSearch className="h-4 w-4" />}
                Vérifier
              </button>
            </div>
          </form>
        </section>

        <section className="min-w-0 max-w-full pb-2 sm:pb-0">
          {result || verifying ? (
            <DocumentVerificationResultCard
              result={result}
              loading={verifying}
              onRetry={lastInput ? () => void verifyValue(lastInput) : undefined}
              compact
              showBrand={false}
            />
          ) : (
            <div className="flex min-h-[12rem] max-w-full flex-col items-center justify-center rounded-[1.25rem] border border-dashed border-emerald-200 bg-white/85 p-4 text-center shadow-sm sm:min-h-[24rem] sm:rounded-[1.7rem] sm:p-6">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-800 ring-1 ring-emerald-950/10 sm:h-16 sm:w-16 sm:rounded-3xl">
                <ShieldCheck className="h-6 w-6 sm:h-8 sm:w-8" />
              </div>
              <h2 className="mt-3 text-lg font-black text-slate-950 sm:mt-5 sm:text-xl">Résultat de vérification</h2>
              <p className="mt-1.5 max-w-md text-xs font-semibold leading-5 text-slate-500 sm:mt-2 sm:text-sm sm:leading-6">
                Le statut du document apparaîtra ici : authentique, introuvable, révoqué ou erreur réseau.
              </p>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
