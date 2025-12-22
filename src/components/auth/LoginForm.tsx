import React, { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';

export function LoginForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { signIn } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await signIn(email, password);
    } catch (err) {
      setError('Email ou mot de passe incorrect');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center" 
         style={{ background: 'linear-gradient(to bottom right, #FFF4E6, #FFFFFF, #FFF5F5)' }}>
      <div className="bg-white p-8 rounded-2xl shadow-xl w-full max-w-md border-t-4" 
           style={{ borderTopColor: '#F58220' }}>
        
        {/* --- Logo avec halo --- */}
        <div className="flex items-center justify-center mb-8 relative">
          <div className="absolute inset-0 opacity-20 blur-xl rounded-full" 
               style={{ background: 'linear-gradient(135deg, #F58220 0%, #C0392B 100%)' }} />
          <div className="relative p-4 rounded-xl shadow-lg" 
               style={{  backgroundColor: 'white' }}>
            <img
              src="/templates/Logo confort immo archi neutre.png"
              alt="Logo Confort Immo Archi"
              className="h-20 w-auto object-contain"
            />
          </div>
        </div>

        {/* --- Titre --- */}
        <h1 className="text-3xl font-bold text-center mb-2">
          <span style={{ color: '#C0392B' }}>CONFORT</span>{' '}
          <span style={{ 
            background: 'linear-gradient(135deg, #F58220 0%, #FFA64D 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text'
          }}>IMMO</span>{' '}
          <span style={{ color: '#C0392B' }}>ARCHI</span>
        </h1>
        <p className="text-center text-sm font-medium mb-3" style={{ color: '#555555' }}>
          Gestion immobilière professionnelle
        </p>
        <div className="h-1 w-20 mx-auto rounded-full mb-8" 
             style={{ background: 'linear-gradient(90deg, #F58220 0%, #C0392B 100%)' }} />

        {/* --- Formulaire --- */}
        <form onSubmit={handleSubmit} className="space-y-6">
          {error && (
            <div className="border-l-4 px-4 py-3 rounded" 
                 style={{ backgroundColor: '#FFF5F5', borderColor: '#C0392B', color: '#922B21' }}>
              <p className="text-sm">{error}</p>
            </div>
          )}

          <div>
            <label htmlFor="email" className="block text-sm font-semibold mb-2" style={{ color: '#555555' }}>
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:outline-none focus:ring-2 transition"
              style={{ '--tw-ring-color': '#F58220' } as React.CSSProperties}
              placeholder="votre@email.com"
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-semibold mb-2" style={{ color: '#555555' }}>
              Mot de passe
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:outline-none focus:ring-2 transition"
              style={{ '--tw-ring-color': '#F58220' } as React.CSSProperties}
              placeholder="••••••••"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full text-white font-bold py-3 px-4 rounded-lg shadow-lg transition transform hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ background: 'linear-gradient(135deg, #F58220 0%, #C0392B 100%)' }}
          >
            {loading ? 'Connexion...' : 'Se connecter'}
          </button>
        </form>

        {/* --- Footer --- */}
        <div className="mt-6 text-center text-sm" style={{ color: '#707070' }}>
          <p>© 2025 Confort Immo Archi. Tous droits réservés.</p>
        </div>
      </div>
    </div>
  );
}
