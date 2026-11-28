export type FieldErrors = Partial<Record<"name" | "email" | "message", string>>;
export type Status = { kind: "idle" | "sending" | "ok" | "error"; text: string };

export function validate(name: string, email: string, message: string): FieldErrors {
  const errors: FieldErrors = {};
  if (!name.trim()) errors.name = "Enter your name.";
  if (!/^\S+@\S+\.\S+$/.test(email.trim())) errors.email = "Enter an email like name@company.com.";
  if (message.trim().length < 10) errors.message = "Write at least a sentence so I know what you need.";
  return errors;
}
