import Link from "next/link";
import { notFound } from "next/navigation";
import { aplicarMedida, convocarDefesa, gerarModeloDisciplinar, registrarAssinaturaDisciplinar, registrarDefesa, revisarJustaCausa } from "@/app/acoes-disciplinar";
import type { UsuarioLogado } from "@/lib/auth/sessao";
import { addDias, formatarData, hojeBrasil, isoData, NOMES_MEDIDA, tipoFalta, type Medida } from "@/lib/calculos";
import { prisma } from "@/lib/db";
import { recomendacaoDaOcorrencia, STATUS_DISCIPLINAR } from "@/lib/servicos/disciplinar";
import { Formulario } from "../Formulario";
import { AreaTexto, Aviso, Campo, Cartao, Marcador, Selecao, Selo, Titulo } from "../ui";

const AVISO_ORIENTATIVO = "As recomendações são orientativas e não substituem análise de advogado em casos graves.";

export async function DetalheOcorrencia({ usuario, id }: { usuario: UsuarioLogado; id: string }) {
  const oc = await prisma.ocorrenciaDisciplinar.findUnique({ where: { id }, include: { empregado: true, cliente: true } });
  if (!oc || (usuario.papel === "CLIENTE" && oc.clienteId !== usuario.clienteId)) notFound();
  const hoje = hojeBrasil();
  const tipo = tipoFalta(oc.tipoFalta);
  const rec = await recomendacaoDaOcorrencia(oc, hoje);
  const docs = await prisma.documento.findMany({ where: { id: { in: oc.documentosIds } }, include: { assinaturas: true }, orderBy: { criadoEm: "asc" } });
  const historico = await prisma.ocorrenciaDisciplinar.findMany({ where: { empregadoId: oc.empregadoId, id: { not: oc.id } }, orderBy: { dataFato: "desc" } });
  const base = usuario.papel === "CONSULTOR" ? "/consultor" : "/cliente";
  const aberta = ["REGISTRADA", "AGUARDANDO_DEFESA", "JUSTA_CAUSA_NEGADA"].includes(oc.status);
  const st = STATUS_DISCIPLINAR[oc.status] ?? { rotulo: oc.status, cor: "cinza" as const };
  const docMedida = docs.find((d) => d.id === oc.documentoId);
  const assinadoEletronico = docMedida?.assinaturas.some((a) => a.papel === "EMPREGADO");

  return (
    <>
      <Titulo subtitulo={`${oc.empregado.nome} · ${usuario.papel === "CONSULTOR" ? `${oc.cliente.nome} · ` : ""}fato em ${formatarData(oc.dataFato)}`} acoes={<Link className="inline-flex min-h-12 items-center rounded-xl border border-slate-300 bg-white px-4 font-semibold" href={`${base}/disciplinar/orientacao`}>Central de orientação</Link>}>
        {tipo.rotulo} <Selo cor={st.cor}>{st.rotulo}</Selo>
      </Titulo>
      <div className="mb-4"><Aviso tipo="aviso">{AVISO_ORIENTATIVO}</Aviso></div>
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Cartao titulo="1–2. Fato registrado">
            <dl className="space-y-1 text-sm">
              <div><dt className="inline text-slate-500">Quando: </dt><dd className="inline">{formatarData(oc.dataFato)}{oc.horaFato ? ` às ${oc.horaFato}` : ""}{oc.local ? ` — ${oc.local}` : ""} (soube em {formatarData(oc.dataCiencia)})</dd></div>
              <div><dt className="inline text-slate-500">Gravidade: </dt><dd className="inline">{oc.gravidade === "gravissima" ? "gravíssima" : oc.gravidade === "media" ? "média" : oc.gravidade}{tipo.art27 ? ` · LC 150, art. 27, ${tipo.art27}` : ""}</dd></div>
              {oc.testemunhas && <div><dt className="inline text-slate-500">Testemunhas: </dt><dd className="inline">{oc.testemunhas}</dd></div>}
            </dl>
            <p className="mt-2 whitespace-pre-line rounded-lg bg-slate-50 p-3 text-sm">{oc.descricao}</p>
            {oc.provasIds.length > 0 && <p className="mt-2 text-sm">Provas: {oc.provasIds.map((p, i) => <a key={p} className="mr-2 font-semibold text-marca-700 underline" target="_blank" href={`/api/arquivos/${p}`}>arquivo {i + 1}</a>)}</p>}
          </Cartao>

          <Cartao titulo="3. Versão da empregada (direito de defesa)">
            {oc.versaoEmpregado ? <p className="whitespace-pre-line rounded-lg bg-slate-50 p-3 text-sm">{oc.versaoEmpregado}</p> : <p className="text-sm text-slate-600">Ainda não registrada. Ouça a empregada antes de decidir: isso evita injustiças e fortalece a medida.</p>}
            {oc.prazoDefesa && <p className="mt-1 text-sm text-slate-600">Prazo dado: {formatarData(oc.prazoDefesa)}</p>}
            {aberta && (
              <div className="mt-3 grid gap-4 sm:grid-cols-2">
                <Formulario acao={registrarDefesa} textoBotao="Registrar versão" variante="secundario">
                  <input type="hidden" name="ocorrenciaId" value={oc.id} />
                  <AreaTexto rotulo="O que a empregada disse" name="versaoEmpregado" defaultValue={oc.versaoEmpregado ?? ""} required />
                </Formulario>
                {!oc.prazoDefesa && (
                  <Formulario acao={convocarDefesa} textoBotao="Gerar convocação" variante="secundario">
                    <input type="hidden" name="ocorrenciaId" value={oc.id} />
                    <Campo rotulo="Prazo sugerido para ela responder" name="prazoDefesa" type="date" defaultValue={isoData(addDias(hoje, 2))} required ajuda="Sugestão: 2 a 3 dias." />
                  </Formulario>
                )}
              </div>
            )}
          </Cartao>

          <Cartao titulo="4–5. Recomendação e checagens de segurança">
            <p className="text-lg font-bold text-marca-700">{NOMES_MEDIDA[rec.medida]}{rec.medida === "SUSPENSAO" ? ` de ${rec.diasSuspensao} dia(s)` : ""}</p>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">{rec.explicacao.map((x) => <li key={x}>{x}</li>)}</ul>
            <div className="mt-3 space-y-2">
              {rec.checagens.map((c) => <Aviso key={c.mensagem} tipo={c.tipo === "bloqueio" || c.tipo === "critico" ? "critico" : c.tipo === "aviso" ? "aviso" : "sucesso"}>{c.tipo === "bloqueio" && <strong>Impedimento: </strong>}{c.mensagem}</Aviso>)}
            </div>
          </Cartao>

          {aberta && (
            <Cartao titulo="6. Decidir e gerar o documento">
              {oc.status === "JUSTA_CAUSA_NEGADA" && oc.parecerConsultor && <div className="mb-3"><Aviso tipo="aviso" titulo="Parecer do consultor">{oc.parecerConsultor}</Aviso></div>}
              <Formulario acao={aplicarMedida} textoBotao="Aplicar medida" variante="primario">
                <input type="hidden" name="ocorrenciaId" value={oc.id} />
                <Selecao rotulo="Medida" name="medida" defaultValue={oc.status === "JUSTA_CAUSA_NEGADA" ? "SUSPENSAO" : rec.medida} opcoes={(["ORIENTACAO_VERBAL", "ADVERTENCIA_ESCRITA", "SUSPENSAO", "JUSTA_CAUSA", "NENHUMA"] as const).filter((m) => !(m === "JUSTA_CAUSA" && oc.status === "JUSTA_CAUSA_NEGADA")).map((m) => ({ valor: m, rotulo: NOMES_MEDIDA[m] }))} />
                <div className="grid gap-3 sm:grid-cols-2">
                  <Campo rotulo="Dias de suspensão (se suspensão)" name="diasSuspensao" type="number" min={1} max={30} defaultValue={rec.diasSuspensao || 1} />
                  <Campo rotulo="Primeiro dia da suspensão" name="inicioSuspensao" type="date" defaultValue={isoData(addDias(hoje, 1))} />
                </div>
                <AreaTexto rotulo="Justificativa (obrigatória se diferente da recomendada)" name="justificativaMedida" />
                {rec.checagens.some((c) => c.tipo === "critico") && <Marcador name="cienteRiscos" rotulo="Li os alertas acima e estou ciente dos riscos." />}
                <p className="text-xs text-slate-500">Proibido: multa em dinheiro, desconto como punição, humilhação, exposição, punição coletiva e redução de salário. A justa causa vai para revisão do consultor.</p>
              </Formulario>
            </Cartao>
          )}

          {oc.status === "EM_ANALISE_CONSULTOR" && (
            <Cartao titulo="Justa causa: revisão obrigatória">
              <Aviso tipo="critico" titulo="Riscos de reversão na Justiça">
                Se a Justiça entender que a falta não foi grave o bastante, que faltaram provas, que houve demora ou punição dupla, a justa causa é revertida e o empregador paga todas as verbas de uma dispensa sem justa causa (aviso prévio, 13º e férias proporcionais, FGTS compensatório) e pode ainda ser condenado por danos morais.
              </Aviso>
              {usuario.papel === "CONSULTOR" ? (
                <Formulario acao={revisarJustaCausa} textoBotao="Registrar decisão" className="mt-3">
                  <input type="hidden" name="ocorrenciaId" value={oc.id} />
                  <Selecao rotulo="Decisão" name="decisao" opcoes={[{ valor: "NEGAR", rotulo: "Não recomendar justa causa (sugerir outra medida)" }, { valor: "APROVAR", rotulo: "Liberar a comunicação de justa causa" }]} />
                  <AreaTexto rotulo="Parecer para o cliente" name="parecer" required rows={4} />
                  <Marcador name="revisadoAdvogado" rotulo="O caso foi analisado por advogado ou o cliente foi orientado a consultar um." />
                </Formulario>
              ) : <p className="mt-3 text-sm text-slate-600">O dossiê está com o consultor. Você será avisado da decisão aqui e no chat.</p>}
            </Cartao>
          )}

          {(oc.status === "MEDIDA_APLICADA" || oc.status === "JUSTA_CAUSA_APROVADA") && docMedida && (
            <Cartao titulo="7. Assinatura da empregada">
              {assinadoEletronico ? <Aviso tipo="sucesso">Assinado eletronicamente pela empregada.</Aviso> : oc.assinaturaForma === "IMPRESSA" ? <Aviso tipo="sucesso">Via impressa assinada arquivada.</Aviso> : oc.recusaAssinatura ? <Aviso tipo="aviso">Recusa registrada com as testemunhas: {oc.testemunhasRecusa}</Aviso> : (
                <div className="space-y-3">
                  <p className="text-sm">Opções: (a) a empregada assina pelo aplicativo de ponto, em “Documentos”; (b) imprima, colha a assinatura e envie a foto; (c) se ela recusar, registre a recusa com duas testemunhas.</p>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Formulario acao={registrarAssinaturaDisciplinar} textoBotao="Enviar via assinada" variante="secundario">
                      <input type="hidden" name="ocorrenciaId" value={oc.id} />
                      <input type="hidden" name="forma" value="IMPRESSA" />
                      <Campo rotulo="Foto ou PDF assinado" name="arquivo" type="file" accept="image/*,application/pdf" required />
                    </Formulario>
                    <Formulario acao={registrarAssinaturaDisciplinar} textoBotao="Registrar recusa" variante="secundario">
                      <input type="hidden" name="ocorrenciaId" value={oc.id} />
                      <input type="hidden" name="forma" value="RECUSA" />
                      <AreaTexto rotulo="Duas testemunhas (nome e CPF, uma por linha)" name="testemunhasRecusa" required />
                    </Formulario>
                  </div>
                </div>
              )}
              {oc.medida === "SUSPENSAO" && <p className="mt-3 text-sm text-slate-600">8. Efeito automático: {oc.diasSuspensao} dia(s) lançados na pré-folha para desconto (rotina mensal). Lance no eSocial como falta.</p>}
              {oc.status === "JUSTA_CAUSA_APROVADA" && <p className="mt-3 text-sm">Depois de entregar a comunicação, registre o desligamento {usuario.papel === "CONSULTOR" ? <Link className="font-semibold text-marca-700 underline" href={`/consultor/empregados/${oc.empregadoId}`}>na página do empregado</Link> : "com o consultor"} e pague as verbas em até 10 dias.</p>}
            </Cartao>
          )}
        </div>

        <div className="space-y-4">
          <Cartao titulo="Documentos">
            <ul className="space-y-2 text-sm">
              {docs.map((d) => (
                <li key={d.id}>
                  <a className="font-semibold text-marca-700 underline" target="_blank" href={`/api/documentos/${d.id}`}>{d.titulo}</a>
                  <span className="block text-xs text-slate-500">{d.assinaturas.map((a) => `${a.papel === "EMPREGADO" ? "empregada" : a.papel === "CLIENTE" ? "empregador" : "consultor"} assinou`).join(", ") || (d.exigeAssinaturaEmpregado || d.exigeAssinaturaCliente ? "sem assinaturas" : "")} · <Link className="underline" href={`${base}/documentos/${d.id}`}>assinar/ver</Link></span>
                </li>
              ))}
              {!docs.length && <li className="text-slate-500">Nenhum documento ainda.</li>}
            </ul>
            <div className="mt-3 space-y-2">
              <Formulario acao={gerarModeloDisciplinar} textoBotao="Gerar registro de ocorrência" variante="secundario" pequeno>
                <input type="hidden" name="ocorrenciaId" value={oc.id} />
                <input type="hidden" name="modelo" value="REGISTRO_OCORRENCIA" />
              </Formulario>
              {oc.tipoFalta === "ABANDONO" && (
                <Formulario acao={gerarModeloDisciplinar} textoBotao="Gerar notificação de abandono" variante="secundario" pequeno>
                  <input type="hidden" name="ocorrenciaId" value={oc.id} />
                  <input type="hidden" name="modelo" value="ABANDONO" />
                </Formulario>
              )}
            </div>
          </Cartao>
          <Cartao titulo="Linha do tempo disciplinar">
            <ol className="relative ml-3 border-l-2 border-slate-200">
              {[oc, ...historico].sort((a, b) => b.dataFato.getTime() - a.dataFato.getTime()).map((h) => (
                <li key={h.id} className="mb-3 ml-4">
                  <span className={`absolute -left-[7px] mt-1.5 h-3 w-3 rounded-full ${h.id === oc.id ? "bg-marca-600" : "bg-slate-400"}`} />
                  <p className="text-xs text-slate-500">{formatarData(h.dataFato)}</p>
                  <p className="text-sm">{tipoFalta(h.tipoFalta).rotulo} — {h.medida ? NOMES_MEDIDA[h.medida as Medida | "NENHUMA"] : STATUS_DISCIPLINAR[h.status]?.rotulo}</p>
                </li>
              ))}
            </ol>
          </Cartao>
        </div>
      </div>
    </>
  );
}
