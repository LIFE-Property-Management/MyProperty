"use client";import { useState } from "react";
import type { ChangeEvent, HTMLInputTypeAttribute, MouseEventHandler, ReactNode } from "react";

type View = "landing" | "login" | "signup";

type LoginErrors = {
  email?: string;
  password?: string;
};

type SignupForm = {
  name: string;
  email: string;
  phone: string;
  password: string;
  confirm: string;
};

type SignupField = keyof SignupForm;

type SignupErrors = {
  name?: string;
  email?: string;
  phone?: string;
  password?: string;
  confirm?: string;
};

type InputProps = {
  label: string;
  type?: HTMLInputTypeAttribute;
  placeholder?: string;
  value: string;
  onChange: (e: ChangeEvent<HTMLInputElement>) => void;
  error?: string;
};

type ButtonProps = {
  children: ReactNode;
  onClick?: MouseEventHandler<HTMLButtonElement>;
  variant?: "primary" | "secondary";
  fullWidth?: boolean;
  disabled?: boolean;
};

type CardProps = {
  children: ReactNode;
};

type LogoProps = {
  size?: number;
};

type LandingViewProps = {
  onLogin: () => void;
  onSignup: () => void;
};

type LoginViewProps = {
  onBack: () => void;
  onSignup: () => void;
};

type SignupViewProps = {
  onBack: () => void;
  onLogin: () => void;
};

const PRIMARY = "#275D2C";
const PRIMARY_LIGHT = "#e8f0e9";
const PRIMARY_DARK = "#1a3d1d";
const BG = "#fbfbff";
const TEXT = "#1a1a1a";
const TEXT_MUTED = "#6b7280";
const BORDER = "#e5e7eb";
const ERROR = "#b91c1c";

const styles = {
    "@import": "https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;500;600&family=DM+Sans:wght@300;400;500&display=swap",
};

function Input({ label, type = "text", placeholder, value, onChange, error }: InputProps) {
    return (
        <div style={{ marginBottom: 16 }}>
            <label style={{ display: "block", fontSize: 13, fontWeight: 500, color: TEXT, marginBottom: 6, fontFamily: "'DM Sans', sans-serif" }}>
                {label}
            </label>
            <input
                type={type}
                placeholder={placeholder}
                value={value}
                onChange={onChange}
                style={{
                    width: "100%",
                    padding: "10px 14px",
                    fontSize: 14,
                    fontFamily: "'DM Sans', sans-serif",
                    border: `1px solid ${error ? ERROR : BORDER}`,
                    borderRadius: 8,
                    outline: "none",
                    background: "#fff",
                    color: TEXT,
                    boxSizing: "border-box",
                    transition: "border-color 0.15s",
                }}
                onFocus={(e) => (e.currentTarget.style.borderColor = PRIMARY)}
                onBlur={(e) => (e.currentTarget.style.borderColor = error ? ERROR : BORDER)}
            />
            {error && <p style={{ margin: "4px 0 0", fontSize: 12, color: ERROR, fontFamily: "'DM Sans', sans-serif" }}>{error}</p>}
        </div>
    );
}

function Button({ children, onClick, variant = "primary", fullWidth, disabled }: ButtonProps) {
    const isPrimary = variant === "primary";
    return (
        <button
            onClick={onClick}
            disabled={disabled}
            style={{
                width: fullWidth ? "100%" : "auto",
                padding: "11px 24px",
                fontSize: 14,
                fontWeight: 500,
                fontFamily: "'DM Sans', sans-serif",
                borderRadius: 8,
                border: isPrimary ? "none" : `1px solid ${BORDER}`,
                background: isPrimary ? PRIMARY : "#fff",
                color: isPrimary ? "#fff" : TEXT,
                cursor: disabled ? "not-allowed" : "pointer",
                opacity: disabled ? 0.6 : 1,
                transition: "all 0.15s",
                letterSpacing: 0.2,
            }}
            onMouseEnter={(e) => {
              if (!disabled) e.currentTarget.style.background = isPrimary ? PRIMARY_DARK : PRIMARY_LIGHT;
            }}
            onMouseLeave={(e) => {
              if (!disabled) e.currentTarget.style.background = isPrimary ? PRIMARY : "#fff";
            }}
        >
            {children}
        </button>
    );
}

function Card({ children }: CardProps) {
    return (
        <div style={{
            background: "#fff",
            borderRadius: 16,
            border: `1px solid ${BORDER}`,
            padding: "36px 40px",
            width: "100%",
            maxWidth: 420,
            boxSizing: "border-box",
        }}>
            {children}
        </div>
    );
}

function Logo({ size = 22 }: LogoProps) {
    return (
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{
                width: size + 8, height: size + 8,
                background: PRIMARY,
                borderRadius: 8,
                display: "flex", alignItems: "center", justifyContent: "center",
            }}>
                <svg width={size - 4} height={size - 4} viewBox="0 0 18 18" fill="none">
                    <path d="M9 2L2 7v9h5v-5h4v5h5V7L9 2z" fill="#fff" fillOpacity={0.9} />
                </svg>
            </div>
            <span style={{ fontFamily: "'Playfair Display', serif", fontSize: size, fontWeight: 600, color: TEXT, letterSpacing: -0.3 }}>
        MyProperty
      </span>
        </div>
    );
}

function LandingView({ onLogin, onSignup } : LandingViewProps) {
    return (
        <div style={{
            minHeight: "100vh",
            background: BG,
            fontFamily: "'DM Sans', sans-serif",
            display: "flex",
            flexDirection: "column",
        }}>
            <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;500;600&family=DM+Sans:wght@300;400;500&display=swap" />

            {/* Nav */}
            <nav style={{
                padding: "20px 48px",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                borderBottom: `1px solid ${BORDER}`,
                background: "#fff",
            }}>
                <Logo />
                <div style={{ display: "flex", gap: 12 }}>
                    <Button variant="secondary" onClick={onLogin}>Log in</Button>
                    <Button onClick={onSignup}>Sign up</Button>
                </div>
            </nav>

            {/* Hero */}
            <div style={{
                flex: 1,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                padding: "80px 24px",
            }}>
                <div style={{ maxWidth: 680, textAlign: "center" }}>
                    {/* Badge */}
                    <div style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 8,
                        background: PRIMARY_LIGHT,
                        border: `1px solid ${PRIMARY}22`,
                        borderRadius: 100,
                        padding: "6px 16px",
                        marginBottom: 32,
                    }}>
                        <div style={{ width: 6, height: 6, borderRadius: "50%", background: PRIMARY }} />
                        <span style={{ fontSize: 13, color: PRIMARY, fontWeight: 500 }}>Property management, simplified</span>
                    </div>

                    <h1 style={{
                        fontFamily: "'Playfair Display', serif",
                        fontSize: "clamp(40px, 6vw, 64px)",
                        fontWeight: 600,
                        color: TEXT,
                        lineHeight: 1.15,
                        margin: "0 0 24px",
                        letterSpacing: -1,
                    }}>
                        Manage your properties<br />
                        <span style={{ color: PRIMARY }}>from anywhere.</span>
                    </h1>

                    <p style={{
                        fontSize: 17,
                        color: TEXT_MUTED,
                        lineHeight: 1.7,
                        margin: "0 auto 40px",
                        maxWidth: 500,
                        fontWeight: 300,
                    }}>
                        Track leases, collect rent, and stay on top of your portfolio — no matter where you are in the world.
                    </p>

                    <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
                        <button
                            onClick={onSignup}
                            style={{
                                padding: "14px 32px",
                                fontSize: 15,
                                fontWeight: 500,
                                fontFamily: "'DM Sans', sans-serif",
                                background: PRIMARY,
                                color: "#fff",
                                border: "none",
                                borderRadius: 10,
                                cursor: "pointer",
                                letterSpacing: 0.2,
                            }}
                            onMouseEnter={e => e.currentTarget.style.background = PRIMARY_DARK}
                            onMouseLeave={e => e.currentTarget.style.background = PRIMARY}
                        >
                            Get started — it's free
                        </button>
                        <button
                            onClick={onLogin}
                            style={{
                                padding: "14px 32px",
                                fontSize: 15,
                                fontWeight: 500,
                                fontFamily: "'DM Sans', sans-serif",
                                background: "#fff",
                                color: TEXT,
                                border: `1px solid ${BORDER}`,
                                borderRadius: 10,
                                cursor: "pointer",
                            }}
                            onMouseEnter={e => e.currentTarget.style.background = PRIMARY_LIGHT}
                            onMouseLeave={e => e.currentTarget.style.background = "#fff"}
                        >
                            Log in
                        </button>
                    </div>

                    {/* Feature pills */}
                    <div style={{
                        display: "flex",
                        gap: 10,
                        justifyContent: "center",
                        flexWrap: "wrap",
                        marginTop: 48,
                    }}>
                        {["Lease management", "Rent tracking", "Tenant portal", "Payment reminders"].map(f => (
                            <span key={f} style={{
                                fontSize: 13,
                                color: TEXT_MUTED,
                                background: "#fff",
                                border: `1px solid ${BORDER}`,
                                borderRadius: 100,
                                padding: "5px 14px",
                            }}>
                {f}
              </span>
                        ))}
                    </div>
                </div>
            </div>

            {/* Footer */}
            <div style={{
                padding: "20px 48px",
                borderTop: `1px solid ${BORDER}`,
                display: "flex",
                justifyContent: "center",
            }}>
                <p style={{ fontSize: 13, color: TEXT_MUTED, margin: 0 }}>
                    © 2026 MyProperty. Built for landlords, by landlords.
                </p>
            </div>
        </div>
    );
}

function LoginView({ onBack, onSignup } : LoginViewProps) {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [errors, setErrors] = useState<LoginErrors>({});
    const [loading, setLoading] = useState(false);

    const validate = () => {
        const e : LoginErrors= {};
        if (!email) e.email = "Email is required";
        else if (!/\S+@\S+\.\S+/.test(email)) e.email = "Enter a valid email";
        if (!password) e.password = "Password is required";
        return e;
    };

    const handleSubmit = () => {
        const e = validate();
        if (Object.keys(e).length) { setErrors(e); return; }
        setLoading(true);
        setTimeout(() => setLoading(false), 1500);
    };

    return (
        <div style={{
            minHeight: "100vh",
            background: BG,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            padding: 24,
            fontFamily: "'DM Sans', sans-serif",
        }}>
            <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;500;600&family=DM+Sans:wght@300;400;500&display=swap" />

            <div style={{ marginBottom: 32 }}><Logo /></div>

            <Card>
                <h2 style={{
                    fontFamily: "'Playfair Display', serif",
                    fontSize: 24,
                    fontWeight: 600,
                    color: TEXT,
                    margin: "0 0 6px",
                    letterSpacing: -0.3,
                }}>
                    Welcome back
                </h2>
                <p style={{ fontSize: 14, color: TEXT_MUTED, margin: "0 0 28px" }}>
                    Log in to your landlord account
                </p>

                <Input
                    label="Email address"
                    type="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={e => { setEmail(e.target.value); setErrors(p => ({ ...p, email: "" })); }}
                    error={errors.email}
                />
                <Input
                    label="Password"
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={e => { setPassword(e.target.value); setErrors(p => ({ ...p, password: "" })); }}
                    error={errors.password}
                />

                <div style={{ textAlign: "right", marginBottom: 20, marginTop: -8 }}>
          <span style={{ fontSize: 13, color: PRIMARY, cursor: "pointer", fontWeight: 500 }}>
            Forgot password?
          </span>
                </div>

                <Button fullWidth onClick={handleSubmit} disabled={loading}>
                    {loading ? "Logging in..." : "Log in"}
                </Button>

                <p style={{ textAlign: "center", fontSize: 13, color: TEXT_MUTED, margin: "20px 0 0" }}>
                    Don't have an account?{" "}
                    <span onClick={onSignup} style={{ color: PRIMARY, cursor: "pointer", fontWeight: 500 }}>
            Sign up
          </span>
                </p>
            </Card>

            <button onClick={onBack} style={{
                marginTop: 20,
                background: "none",
                border: "none",
                color: TEXT_MUTED,
                fontSize: 13,
                cursor: "pointer",
                fontFamily: "'DM Sans', sans-serif",
            }}>
                ← Back to home
            </button>
        </div>
    );
}

function SignupView({ onBack, onLogin } :SignupViewProps) {
    const [form, setForm] = useState<SignupForm>({ name: "", email: "", phone: "", password: "", confirm: "" });
    const [errors, setErrors] = useState<SignupErrors>({});
    const [loading, setLoading] = useState(false);

    const set = (field : SignupField) => (e: ChangeEvent<HTMLInputElement>) => {
        setForm(p => ({ ...p, [field]: e.target.value }));
        setErrors(p => ({ ...p, [field]: "" }));
    };

    const validate = () => {
        const e : SignupErrors = {};
        if (!form.name.trim()) e.name = "Full name is required";
        if (!form.email) e.email = "Email is required";
        else if (!/\S+@\S+\.\S+/.test(form.email)) e.email = "Enter a valid email";
        if (!form.phone.trim()) e.phone = "Phone number is required";
        if (!form.password) e.password = "Password is required";
        else if (form.password.length < 8) e.password = "At least 8 characters";
        if (!form.confirm) e.confirm = "Please confirm your password";
        else if (form.confirm !== form.password) e.confirm = "Passwords do not match";
        return e;
    };

    const handleSubmit = () => {
        const e = validate();
        if (Object.keys(e).length) { setErrors(e); return; }
        setLoading(true);
        setTimeout(() => setLoading(false), 1500);
    };

    return (
        <div style={{
            minHeight: "100vh",
            background: BG,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            padding: 24,
            fontFamily: "'DM Sans', sans-serif",
        }}>
            <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;500;600&family=DM+Sans:wght@300;400;500&display=swap" />

            <div style={{ marginBottom: 32 }}><Logo /></div>

            <Card>
                <h2 style={{
                    fontFamily: "'Playfair Display', serif",
                    fontSize: 24,
                    fontWeight: 600,
                    color: TEXT,
                    margin: "0 0 6px",
                    letterSpacing: -0.3,
                }}>
                    Create your account
                </h2>
                <p style={{ fontSize: 14, color: TEXT_MUTED, margin: "0 0 28px" }}>
                    Sign up as a landlord — free to get started
                </p>

                <Input label="Full name" placeholder="John Smith" value={form.name} onChange={set("name")} error={errors.name} />
                <Input label="Email address" type="email" placeholder="you@example.com" value={form.email} onChange={set("email")} error={errors.email} />
                <Input label="Phone number" type="tel" placeholder="+383 44 000 000" value={form.phone} onChange={set("phone")} error={errors.phone} />
                <Input label="Password" type="password" placeholder="Min. 8 characters" value={form.password} onChange={set("password")} error={errors.password} />
                <Input label="Confirm password" type="password" placeholder="Repeat your password" value={form.confirm} onChange={set("confirm")} error={errors.confirm} />

                <Button fullWidth onClick={handleSubmit} disabled={loading}>
                    {loading ? "Creating account..." : "Create account"}
                </Button>

                <p style={{ textAlign: "center", fontSize: 13, color: TEXT_MUTED, margin: "20px 0 0" }}>
                    Already have an account?{" "}
                    <span onClick={onLogin} style={{ color: PRIMARY, cursor: "pointer", fontWeight: 500 }}>
            Log in
          </span>
                </p>
            </Card>

            <button onClick={onBack} style={{
                marginTop: 20,
                background: "none",
                border: "none",
                color: TEXT_MUTED,
                fontSize: 13,
                cursor: "pointer",
                fontFamily: "'DM Sans', sans-serif",
            }}>
                ← Back to home
            </button>
        </div>
    );
}

export default function App() {
    const [view, setView] = useState<View>("landing");

    if (view === "login") return <LoginView onBack={() => setView("landing")} onSignup={() => setView("signup")} />;
    if (view === "signup") return <SignupView onBack={() => setView("landing")} onLogin={() => setView("login")} />;
    return <LandingView onLogin={() => setView("login")} onSignup={() => setView("signup")} />;
}