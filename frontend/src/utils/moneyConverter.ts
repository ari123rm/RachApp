export default function moneyConverter(valor: any): string {
  if (valor === undefined || valor === null || valor === '') return '0,00';
  const num = typeof valor === 'number' ? valor : parseFloat(String(valor).replace(',', '.'));
  if (isNaN(num)) return '0,00';

  // O Number.EPSILON evita erros de precisão (ex: 1.005 virar 1.004999)
  // Multiplicamos por 100 para isolar os centavos, arredondamos e dividimos de volta
  const valorArredondado = Math.round((num + Number.EPSILON) * 100) / 100;

  // Formata para o padrão brasileiro (vírgula e 2 casas)
  return valorArredondado.toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}
