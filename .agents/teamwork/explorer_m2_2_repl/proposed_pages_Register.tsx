import React, { useState, FormEvent, useEffect } from 'react';
import { BookOpen, User, Mail, Lock, Eye, EyeOff, Globe, AlertCircle, CheckCircle, ArrowRight } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useRouter, Link } from '../contexts/RouterContext';
import { ApiError } from '../lib/api';
import { detectBrowserTimezone, formatTimezoneLabel } from '../lib/timezone';

export function Register() {
  const { register } = useAuth();
  const { navigate } = useRouter();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirmation, setPasswordConfirmation] = useState('');
  const [timezone, setTimezone] = useState('America/Sao_Paulo');
  const [showPassword, setShowPassword] = useState(false);

  const [fieldErrors, setFieldErrors] = useState<{
    name?: string;
    email?: string;
    password?: string;
    passwordConfirmation?: string;
  }>({});
  const [generalError, setGeneralError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    setTimezone(detectBrowserTimezone());
  }, []);

  const validate = (): boolean => {
    const errors: {
      name?: string;
      email?: string;
      password?: string;
      passwordConfirmation?: string;
    } = {};

    if (!name.trim()) {
      errors.name = 'O nome é obrigatório.';
    } else if (name.trim().length < 2) {
      errors.name = 'O nome deve conter ao menos 2 caracteres.';
    }

    if (!email.trim()) {
      errors.email = 'O e-mail é obrigatório.';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      errors.email = 'Formato de e-mail inválido.';
    }

    if (!password) {
      errors.password = 'A senha é obrigatória.';
    } else if (password.length < 6) {
      errors.password = 'A senha deve conter ao menos 6 caracteres.';
    }

    if (!passwordConfirmation) {
      errors.passwordConfirmation = 'A confirmação de senha é obrigatória.';
    } else if (password !== passwordConfirmation) {
      errors.passwordConfirmation = 'As senhas não coincidem.';
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
      await register({
        name: name.trim(),
        email: email.trim(),
        password,
        timezone,
      });
      navigate('/dashboard', { replace: true });
    } catch (error) {
      if (error instanceof ApiError) {
        setGeneralError(error.message);
        if (error.details) {
          const detailedErrors: Record<string, string> = {};
          error.details.forEach((d) => {
            if (d.field) detailedErrors[d.field] = d.message;
          });
          setFieldErrors((prev) => ({ ...prev, ...detailedErrors }));
        }
      } else {
        setGeneralError('Não foi possível conectar ao servidor. Tente novamente.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-50 via-blue-50/30 to-slate-100 p-4">
      <div className="w-full max-w-md">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-lg shadow-blue-500/25">
            <BookOpen className="h-6 w-6" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Plataforma de Estudos
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Crie sua conta para estruturar seu cronograma e matérias
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200/80 bg-white p-8 shadow-xl shadow-slate-200/50">
          <h2 className="mb-5 text-lg font-bold text-slate-800">Criar nova conta</h2>

          {generalError && (
            <div className="mb-5 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{generalError}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-3.5" noValidate>
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-700">Nome completo</label>
              <div className="relative">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400">
                  <User className="h-4 w-4" />
                </div>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Seu nome completo"
                  autoComplete="name"
                  className={`w-full rounded-xl border bg-slate-50/50 py-2 pl-10 pr-3.5 text-sm outline-none transition-all focus:bg-white focus:ring-2 ${
                    fieldErrors.name ? 'border-red-300 focus:ring-red-100' : 'border-slate-200 focus:ring-blue-100'
                  }`}
                />
              </div>
              {fieldErrors.name && <p className="mt-1 text-xs text-red-600">{fieldErrors.name}</p>}
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-700">E-mail</label>
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
                  className={`w-full rounded-xl border bg-slate-50/50 py-2 pl-10 pr-3.5 text-sm outline-none transition-all focus:bg-white focus:ring-2 ${
                    fieldErrors.email ? 'border-red-300 focus:ring-red-100' : 'border-slate-200 focus:ring-blue-100'
                  }`}
                />
              </div>
              {fieldErrors.email && <p className="mt-1 text-xs text-red-600">{fieldErrors.email}</p>}
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-700">Senha</label>
              <div className="relative">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400">
                  <Lock className="h-4 w-4" />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Mínimo de 6 caracteres"
                  autoComplete="new-password"
                  className={`w-full rounded-xl border bg-slate-50/50 py-2 pl-10 pr-10 text-sm outline-none transition-all focus:bg-white focus:ring-2 ${
                    fieldErrors.password ? 'border-red-300 focus:ring-red-100' : 'border-slate-200 focus:ring-blue-100'
                  }`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 flex items-center pr-3.5 text-slate-400 hover:text-slate-600"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {fieldErrors.password && <p className="mt-1 text-xs text-red-600">{fieldErrors.password}</p>}
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-700">Confirmação de senha</label>
              <div className="relative">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400">
                  <Lock className="h-4 w-4" />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={passwordConfirmation}
                  onChange={(e) => setPasswordConfirmation(e.target.value)}
                  placeholder="Repita sua senha"
                  autoComplete="new-password"
                  className={`w-full rounded-xl border bg-slate-50/50 py-2 pl-10 pr-3.5 text-sm outline-none transition-all focus:bg-white focus:ring-2 ${
                    fieldErrors.passwordConfirmation ? 'border-red-300 focus:ring-red-100' : 'border-slate-200 focus:ring-blue-100'
                  }`}
                />
              </div>
              {fieldErrors.passwordConfirmation && (
                <p className="mt-1 text-xs text-red-600">{fieldErrors.passwordConfirmation}</p>
              )}
            </div>

            {/* Indicador de Fuso Horário Detectado */}
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
              <div className="flex items-center gap-2 font-medium text-slate-800">
                <Globe className="h-4 w-4 text-blue-600" />
                <span>Fuso horário detectado:</span>
              </div>
              <p className="mt-1 pl-6 text-slate-500 font-mono text-[11px]">
                {formatTimezoneLabel(timezone)}
              </p>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 py-2.5 text-sm font-semibold text-white shadow-md shadow-blue-500/20 transition-all hover:bg-blue-700 disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  <span>Cadastrando...</span>
                </>
              ) : (
                <>
                  <span>Criar conta</span>
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </button>
          </form>

          <div className="mt-6 border-t border-slate-100 pt-4 text-center">
            <p className="text-xs text-slate-600">
              Já possui uma conta?{' '}
              <Link to="/login" className="font-semibold text-blue-600 hover:underline">
                Faça login
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
