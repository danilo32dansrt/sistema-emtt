import { Formulario } from "@/components/Formulario";
import { Aviso, Cartao, Selecao, Titulo } from "@/components/ui";
import { exigirCliente } from "@/lib/auth/sessao";
import { formatarData } from "@/lib/calculos";
import { prisma } from "@/lib/db";
import { RAIOS_PERMITIDOS } from "@/lib/ponto/geo";
import { salvarRaio } from "./acoes";
import { MarcarLocal } from "./MarcarLocal";

export const metadata = { title: "Local da casa" };

export default async function LocalDaCasa() {
  const u = await exigirCliente();
  const c = await prisma.cliente.findUniqueOrThrow({ where: { id: u.clienteId! }, select: { localLatitude: true, localLongitude: true, localRaioMetros: true, localDefinidoEm: true } });
  const marcado = c.localLatitude !== null && c.localLongitude !== null;
  return (
    <>
      <Titulo subtitulo="A empregada marca a entrada e a saída pelo GPS do celular, só dentro da casa.">Local da casa</Titulo>
      <div className="space-y-4">
        {marcado ? (
          <Aviso tipo="sucesso" titulo="Local marcado">
            Marcado em {formatarData(c.localDefinidoEm)} · raio de {c.localRaioMetros} m.{" "}
            <a className="font-semibold underline" target="_blank" rel="noreferrer" href={`https://www.google.com/maps?q=${c.localLatitude},${c.localLongitude}`}>Ver no mapa</a>
          </Aviso>
        ) : (
          <Aviso tipo="aviso" titulo="Falta marcar o local da casa">Enquanto não for marcado, o ponto da empregada é aceito de qualquer lugar.</Aviso>
        )}
        <Cartao titulo={marcado ? "Marcar de novo" : "Como marcar"}>
          <ol className="mb-4 list-decimal space-y-1 pl-5 text-sm text-slate-700">
            <li>Vá até o <b>meio da casa</b> com este celular.</li>
            <li>Toque no botão abaixo e permita o acesso à localização.</li>
            <li>Escolha a distância permitida e salve.</li>
          </ol>
          <MarcarLocal raioAtual={c.localRaioMetros} />
        </Cartao>
        {marcado && (
          <Cartao titulo="Distância permitida">
            <Formulario acao={salvarRaio} textoBotao="Salvar distância" variante="secundario">
              <Selecao rotulo="Raio a partir do meio da casa" name="raio" defaultValue={String(c.localRaioMetros)} opcoes={RAIOS_PERMITIDOS.map((r) => ({ valor: String(r), rotulo: `${r} metros` }))} ajuda="Dentro de casa o GPS costuma errar de 5 a 30 metros: o sistema já soma essa margem. Se a empregada for barrada estando na casa, aumente para 20 ou 30 m." />
            </Formulario>
          </Cartao>
        )}
        <p className="text-xs text-slate-500">Privacidade (LGPD): a localização da empregada só é pega no momento da marcação, nunca o tempo todo. Se ela marcar fora da casa dizendo que está lá, a marcação fica registrada e você recebe um aviso.</p>
      </div>
    </>
  );
}
