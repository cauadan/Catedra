import React, { useState, FormEvent } from 'react';
import { GraduationCap, Mail, Lock, Eye, EyeOff, AlertCircle, ArrowRight } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useRouter, Link } from '../contexts/RouterContext';
import { ApiError } from '../lib/api';

export function Login() {
  const { login } = useAuth();
  const { navigate } = useRouter();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const [fieldErrors, setFieldErrors] = useState<{ email?: string; password?: string }>({});
  const [generalError, setGeneralError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const validate = (): boolean => {
    const errors: { email?: string; password?: string } = {};

    if (!email.trim()) {
      errors.email = 'O e-mail é obrigatório.';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      errors.email = 'Formato de e-mail inválido.';
    }

    if (!password) {
      errors.password = 'A senha é obrigatória.';
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setGeneralError(null);

    if (!validate()) {
      return;
    }

    setIsSubmitting(true);
    try {
      await login({
        email: email.trim(),
        password,
      });
      navigate('/dashboard', { replace: true });
    } catch (error) {
      if (error instanceof ApiError) {
        setGeneralError(error.message);
        if (error.details) {
          const detailedErrors: { email?: string; password?: string } = {};
          error.details.forEach((d) => {
            if (d.field === 'email') detailedErrors.email = d.message;
            if (d.field === 'password') detailedErrors.password = d.message;
          });
          setFieldErrors((prev) => ({ ...prev, ...detailedErrors }));
        }
      } else {
        setGeneralError('Não foi possí­vel conectar ao servidor. Tente novamente.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-50 via-blue-50/30 to-slate-100 p-4">
      <div className="w-full max-w-md">
        {/* Cabeçalho de Marca */}
        <div className="mb-8 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-600 text-white shadow-lg shadow-emerald-500/25">
            <GraduationCap className="h-6 w-6" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Plataforma de Estudos
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Acesse sua conta para continuar sua jornada de aprendizado
          </p>
        </div>

        {/* Card do Formulário */}
        <div className="rounded-2xl border border-slate-200/80 bg-white p-8 shadow-xl shadow-slate-200/50 backdrop-blur-sm">
          <h2 className="mb-6 text-lg font-bold text-slate-800">Entrar na plataforma</h2>

          {generalError && (
            <div className="mb-5 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{generalError}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-slate-700">
                E-mail
              </label>
              <div className="relative">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400">
                  <Mail className="h-4 w-4" />
                </div>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="seu.email@exemplo.com"
                  autoComplete="email"
                  className={`w-full rounded-xl border bg-slate-50/50 py-2.5 pl-10 pr-3.5 text-sm text-slate-900 placeholder-slate-400 outline-none transition-all focus:bg-white focus:ring-2 ${
                    fieldErrors.email
                      ? 'border-red-300 focus:border-red-500 focus:ring-red-100'
                      : 'border-slate-200 focus:border-blue-500 focus:ring-blue-100'
                  }`}
                />
              </div>
              {fieldErrors.email && (
                <p className="mt-1 text-xs text-red-600 font-medium">{fieldErrors.email}</p>
              )}
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-semibold text-slate-700">
                Senha
              </label>
              <div className="relative">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400">
                  <Lock className="h-4 w-4" />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Sua senha cadastrada"
                  autoComplete="current-password"
                  className={`w-full rounded-xl border bg-slate-50/50 py-2.5 pl-10 pr-10 text-sm text-slate-900 placeholder-slate-400 outline-none transition-all focus:bg-white focus:ring-2 ${
                    fieldErrors.password
                      ? 'border-red-300 focus:border-red-500 focus:ring-red-100'
                      : 'border-slate-200 focus:border-blue-500 focus:ring-blue-100'
                  }`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 flex items-center pr-3.5 text-slate-400 hover:text-slate-600"
                  tabIndex={-1}
                  aria-label={showPassword ? 'Ocultar senha' : 'Exibir senha'}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {fieldErrors.password && (
                <p className="mt-1 text-xs text-red-600 font-medium">{fieldErrors.password}</p>
              )}
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 py-2.5 text-sm font-semibold text-white shadow-md shadow-blue-500/20 transition-all hover:bg-blue-700 active:scale-[0.99] disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  <span>Entrando...</span>
                </>
              ) : (
                <>
                  <span>Entrar</span>
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </button>
          </form>

          <div className="mt-6 border-t border-slate-100 pt-5 text-center">
            <p className="text-xs text-slate-600">
              Não possui uma conta?{' '}
              <Link
                to="/register"
                className="font-semibold text-blue-600 hover:text-blue-700 hover:underline"
              >
                Cadastre-se gratuitamente
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

