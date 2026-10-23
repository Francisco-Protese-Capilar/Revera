// A home não reexporta o metadata de /produtos: o template "%s — marca" do
// layout raiz não vale para a página da própria raiz, e o <title> saía só
// "Próteses" (medido em 22/10/2026). Sem metadata própria, vale o
// `title.default` e a descrição da marca definidos no layout.
export { default } from "./produtos/page";
