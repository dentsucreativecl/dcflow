'use client'

import { useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { Loader2, ArrowLeft, Mail } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

export default function ForgotPasswordPage() {
    const [email, setEmail] = useState('')
    const [error, setError] = useState('')
    const [success, setSuccess] = useState(false)
    const [loading, setLoading] = useState(false)

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setError('')
        setLoading(true)

        const supabase = createClient()

        const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
            redirectTo: window.location.origin + '/reset-password',
        })

        if (resetError) {
            setError(resetError.message)
        } else {
            setSuccess(true)
        }

        setLoading(false)
    }

    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
            <div className="absolute inset-0 overflow-hidden">
                <div className="absolute -top-40 -right-40 w-80 h-80 bg-[#F2A6A6]/20 rounded-full blur-3xl" />
                <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-[#17385C]/20 rounded-full blur-3xl" />
            </div>

            <div className="relative w-full max-w-md px-6">
                <div className="text-center mb-8">
                    <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-black mb-4 overflow-hidden">
                        <Image
                            src="/img/dc-ico.png"
                            alt="DC Flow"
                            width={80}
                            height={80}
                            className="object-contain"
                        />
                    </div>
                    <h1 className="text-3xl font-bold text-white">DC Flow</h1>
                    <p className="text-slate-400 mt-2">Recuperar contraseña</p>
                </div>

                <div className="bg-white/10 backdrop-blur-xl rounded-2xl p-8 shadow-2xl border border-white/20">
                    {success ? (
                        <div className="text-center">
                            <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-green-500/20 mb-4">
                                <Mail className="w-7 h-7 text-green-400" />
                            </div>
                            <h2 className="text-xl font-semibold text-white mb-2">Revisa tu correo</h2>
                            <p className="text-slate-400 text-sm mb-6">
                                Te enviamos un enlace para restablecer tu contraseña a <span className="text-white font-medium">{email}</span>
                            </p>
                            <Link
                                href="/login"
                                className="inline-flex items-center gap-2 text-[#F2A6A6] hover:underline text-sm"
                            >
                                <ArrowLeft className="w-4 h-4" />
                                Volver al login
                            </Link>
                        </div>
                    ) : (
                        <>
                            <h2 className="text-xl font-semibold text-white mb-2">¿Olvidaste tu contraseña?</h2>
                            <p className="text-slate-400 text-sm mb-6">
                                Ingresa tu email y te enviaremos un enlace para restablecerla.
                            </p>

                            <form onSubmit={handleSubmit} className="space-y-5">
                                {error && (
                                    <div className="bg-red-500/10 border border-red-500/20 text-red-400 px-4 py-3 rounded-lg text-sm">
                                        {error}
                                    </div>
                                )}

                                <div>
                                    <label htmlFor="email" className="block text-sm font-medium text-slate-300 mb-2">
                                        Email
                                    </label>
                                    <input
                                        id="email"
                                        type="email"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-[#F2A6A6]/50 focus:border-transparent transition"
                                        placeholder="tu@email.com"
                                        required
                                    />
                                </div>

                                <button
                                    type="submit"
                                    disabled={loading}
                                    className="w-full py-3 px-4 bg-gradient-to-r from-[#F2A6A6] to-[#17385C] text-white font-semibold rounded-lg hover:opacity-90 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                                >
                                    {loading ? (
                                        <>
                                            <Loader2 className="w-5 h-5 animate-spin" />
                                            Enviando...
                                        </>
                                    ) : (
                                        'Enviar enlace de recuperación'
                                    )}
                                </button>
                            </form>

                            <p className="text-center text-slate-400 text-sm mt-6">
                                <Link href="/login" className="inline-flex items-center gap-1 text-[#F2A6A6] hover:underline">
                                    <ArrowLeft className="w-3.5 h-3.5" />
                                    Volver al login
                                </Link>
                            </p>
                        </>
                    )}
                </div>

                <div className="text-center mt-8">
                    <Image
                        src="/img/dc-logo.png"
                        alt="Dentsu Creative"
                        width={150}
                        height={40}
                        priority
                        className="inline-block opacity-50 hover:opacity-80 transition invert"
                    />
                </div>
            </div>
        </div>
    )
}
