// Event bus pour la verification OTP hebdomadaire.
// Coordonne l'intercepteur Axios avec le modal de saisie OTP.

export const OTP_GATE_EVENT = "gp-otp-gate";

type Resolver = { resolve: () => void; reject: (reason?: unknown) => void };

let pending: Resolver | null = null;

export function requireOtpVerification(): Promise<void> {
  // Si une verification est deja en cours, toutes les requetes attendent le meme resultat.
  if (pending) {
    return new Promise((resolve, reject) => {
      const prev = pending!;
      pending = {
        resolve: () => {
          prev.resolve();
          resolve();
        },
        reject: (reason) => {
          prev.reject(reason);
          reject(reason);
        },
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
  pending?.reject(new Error("OTP annule"));
  pending = null;
}
