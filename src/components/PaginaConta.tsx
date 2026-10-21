import { trocarSenha } from "@/app/login/conta-acoes";
import type { UsuarioLogado } from "@/lib/auth/sessao";
import { Formulario } from "./Formulario";
import { Aviso, Campo, Cartao, Titulo } from "./ui";

export function PaginaConta({ usuario }: { usuario: UsuarioLogado }) {
  return (
    <>
      <Titulo subtitulo={usuario.email}>Minha conta</Titulo>
      {usuario.trocarSenha && <div className="mb-4"><Aviso tipo="aviso">Você está usando uma senha provisória. Crie uma senha pessoal agora.</Aviso></div>}
      <Cartao titulo="Trocar senha" className="max-w-lg">
        <Formulario acao={trocarSenha} textoBotao="Trocar senha" limparAoSalvar>
          <Campo rotulo="Senha atual" name="atual" type="password" autoComplete="current-password" required />
          <Campo rotulo="Nova senha" name="nova" type="password" autoComplete="new-password" required ajuda="Pelo menos 8 caracteres, com letras e números." />
          <Campo rotulo="Confirme a nova senha" name="confirmacao" type="password" autoComplete="new-password" required />
        </Formulario>
      </Cartao>
    </>
  );
}
