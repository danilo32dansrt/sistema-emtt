import QRCode from "qrcode";
import { Aviso, Cartao, Selo, Titulo, Vazio } from "@/components/ui";
import { exigirCliente } from "@/lib/auth/sessao";
import { formatarCompetencia, formatarData, formatarMoeda, hojeBrasil } from "@/lib/calculos";
import { num } from "@/lib/conversao";
import { prisma } from "@/lib/db";
import { gerarPixCopiaECola } from "@/lib/pix";
import { configuracao } from "@/lib/tabelas-db";
import { CopiarTexto } from "@/components/CopiarTexto";
import { cobrancaAtiva } from "@/lib/inter/regras";

export const metadata = { title: "Mensalidade" };

export default async function Mensalidade() {
  const u = await exigirCliente();
  const hoje = hojeBrasil();
  const [cfg, lista] = await Promise.all([configuracao(), prisma.mensalidade.findMany({ where: { clienteId: u.clienteId }, orderBy: [{ ano: "desc" }, { mes: "desc" }], take: 12 })]);
  const abertas = lista.filter((m) => m.status === "ABERTO");
  const pix = await Promise.all(
    abertas.map(async (m) => {
      // Cobrança do Banco Inter: Pix com baixa automática + boleto
      if (m.pixCopiaECola && cobrancaAtiva(m.interSituacao)) return { id: m.id, codigo: m.pixCopiaECola, qr: await QRCode.toDataURL(m.pixCopiaECola, { margin: 1, width: 240 }), inter: true };
      if (!cfg.chavePix) return null;
      const codigo = gerarPixCopiaECola({ chave: cfg.chavePix, nome: cfg.nomePix ?? cfg.nomeConsultoria, cidade: cfg.cidadePix ?? cfg.cidade ?? "BRASIL", valor: num(m.valor), txid: m.txid ?? `MENS${m.ano}${String(m.mes).padStart(2, "0")}`, descricao: `Mensalidade ${formatarCompetencia(m.ano, m.mes)}` });
      return { id: m.id, codigo, qr: await QRCode.toDataURL(codigo, { margin: 1, width: 240 }), inter: false };
    }),
  );
  return (
    <>
      <Titulo>Mensalidade da consultoria</Titulo>
      {!cfg.chavePix && !abertas.some((m) => m.pixCopiaECola) && abertas.length > 0 && <div className="mb-4"><Aviso tipo="aviso">O consultor ainda não cadastrou a chave Pix. Fale com ele pelo chat.</Aviso></div>}
      <div className="space-y-4">
        {abertas.map((m, i) => (
          <Cartao key={m.id} titulo={`${formatarCompetencia(m.ano, m.mes)} — ${formatarMoeda(num(m.valor))}`}>
            <p className="mb-3 text-sm">Vencimento {formatarData(m.vencimento)} {m.vencimento < hoje ? <Selo cor="vermelho">atrasada</Selo> : <Selo cor="amarelo">em aberto</Selo>}</p>
            {pix[i] && (
              <div className="flex flex-col items-center gap-3 sm:flex-row sm:items-start">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={pix[i]!.qr} alt="QR Code Pix" width={200} height={200} className="rounded-xl border border-slate-200" />
                <div className="w-full min-w-0">
                  <p className="text-sm font-semibold">Pix copia e cola</p>
                  <CopiarTexto texto={pix[i]!.codigo} />
                  {pix[i]!.inter && m.linhaDigitavel && (
                    <>
                      <p className="mt-3 text-sm font-semibold">Ou pague pelo boleto (linha digitável)</p>
                      <CopiarTexto texto={m.linhaDigitavel} />
                      <a className="mt-2 inline-flex min-h-11 items-center rounded-xl border border-slate-300 px-4 text-sm font-semibold" href={`/api/inter/boleto/${m.id}`} target="_blank" rel="noreferrer">Baixar boleto em PDF</a>
                    </>
                  )}
                  <p className="mt-2 text-xs text-slate-500">{pix[i]!.inter ? "Assim que o banco confirmar o pagamento, a mensalidade aparece como paga aqui — não precisa avisar." : "Depois de pagar, o consultor dá baixa. Dúvidas? Use o chat."}</p>
                </div>
              </div>
            )}
          </Cartao>
        ))}
        {!abertas.length && <Vazio>Nenhuma mensalidade em aberto. Obrigado! 🎉</Vazio>}
        <Cartao titulo="Histórico">
          <ul className="space-y-1 text-sm">
            {lista.map((m) => <li key={m.id} className="flex justify-between"><span>{formatarCompetencia(m.ano, m.mes)} — {formatarMoeda(num(m.valor))}</span><Selo cor={m.status === "PAGO" ? "verde" : "amarelo"}>{m.status === "PAGO" ? `pago ${m.pagoEm ? formatarData(m.pagoEm) : ""}` : "aberto"}</Selo></li>)}
          </ul>
        </Cartao>
      </div>
    </>
  );
}
