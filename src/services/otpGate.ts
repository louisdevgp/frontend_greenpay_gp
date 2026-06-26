// Event bus pour la vérification OTP hebdomadaire.
// Coordinate entre l'intercepteur Axios (qui détecte le besoin)
// et OtpVerificationModal (qui affiche le code et valide).

export const OTP_GATE_EVENT = "gp-otp-gate";

type Resolver = { resolve: () => void; reject: (reason?: unknown) => void };

let pending: Resolver | null = null;

export function requireOtpVerification(): Promise<void> {
  // Si une vérification est déjà en cours, on s'y accroche
  if (pending) {
    return new Promise((resolve, reject) => {
      const prev = pending!;
      pending = {
        resolve: () => { prev.resolve(); resolve(); },
        reject: (r) => { prev.reject(r); reject(r); },
      };
    });
  }
  return new Promise((resolve, reject) => {
    pending = { resolve, reject };
    window.dispatchEvent(new CustomEvent(OTP_GATE_EVENT));
  });
}

export function otpVerified(): void {
  pending?.resolve();
  pending = null;
}

export function otpCancelled(): void {
  pending?.reject(new Error("OTP annulé"));
  pending = null;
}
