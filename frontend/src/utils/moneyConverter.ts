export default function moneyConverter(valor: number): string {
  // O Number.EPSILON evita erros de precisão (ex: 1.005 virar 1.004999)
  // Multiplicamos por 100 para isolar os centavos, arredondamos e dividimos de volta
  const valorArredondado = Math.round((valor + Number.EPSILON) * 100) / 100;

  // Formata para o padrão brasileiro (vírgula e 2 casas)
  return valorArredondado.toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}