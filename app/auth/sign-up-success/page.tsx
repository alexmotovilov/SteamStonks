import Link from "next/link"

export default function SignUpSuccessPage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background gap-3">

      {/* Gargoyle with success text overlaid on slate */}
      <div className="relative w-full max-w-[360px] select-none">
        <img
          src="/gargoyle.png"
          alt=""
          className="w-full pointer-events-none"
          draggable={false}
        />

        {/* Text positioned over the stone slate */}
        <div
          className="absolute flex flex-col items-center justify-center gap-2 text-center px-1"
          style={{ top: "30%", left: "19%", width: "62%", bottom: "17%" }}
        >
          <p className="font-display text-[13px] tracking-wide text-stone-200 leading-tight" style={{ textShadow: "0 1px 4px rgba(0,0,0,0.9), 0 0 8px rgba(0,0,0,0.7)" }}>
            Check Your Email
          </p>
          <p className="font-body text-[11px] text-stone-400 leading-snug" style={{ textShadow: "0 1px 3px rgba(0,0,0,0.9), 0 0 6px rgba(0,0,0,0.7)" }}>
            A confirmation link has been sent. Click it to complete your registration and enter the circle.
          </p>
        </div>
      </div>

      {/* Button below the gargoyle */}
      <div className="flex flex-col gap-2 w-full max-w-[224px] -mt-1">
        <Link
          href="/auth/login"
          className="w-full text-center bg-stone-900/70 hover:bg-stone-800/80 border border-stone-500/50 rounded font-display text-[11px] tracking-wide text-stone-200 py-1.5 transition-colors"
        >
          Back to Sign In
        </Link>
      </div>

    </div>
  )
}
