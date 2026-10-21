import bcrypt from "bcryptjs";

export async function gerarHashSenha(senha: string): Promise<string> {
  return bcrypt.hash(senha, 12);
}

export async function conferirSenha(senha: string, hash: string): Promise<boolean> {
  return bcrypt.compare(senha, hash);
}

/** Regras mínimas de senha: 8+ caracteres, com letra e número. */
export function validarForcaSenha(senha: string): string | null {
  if (senha.length < 8) return "A senha deve ter pelo menos 8 caracteres.";
  if (!/[a-zA-Z]/.test(senha) || !/\d/.test(senha)) return "A senha deve ter letras e números.";
  return null;
}

/** Senha provisória legível para enviar ao cliente/empregado. */
export function gerarSenhaProvisoria(): string {
  const letras = "abcdefghjkmnpqrstuvwxyz";
  const numeros = "23456789";
  const bytes = crypto.getRandomValues(new Uint8Array(10));
  let s = "";
  for (let i = 0; i < 6; i++) s += letras[bytes[i] % letras.length];
  for (let i = 6; i < 10; i++) s += numeros[bytes[i] % numeros.length];
  return s;
}
