const APP_TIME_ZONE = "America/Sao_Paulo";

function pad(value: number) {
  return String(value).padStart(2, "0");
}

function parseDateParts(dateString: string) {
  const [year, month, day] = dateString.split("-").map(Number);
  return { year, month, day };
}

function formatDateInput(date: Date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/**
 * Data (YYYY-MM-DD) de um instante no fuso do app. Use sempre que o ponto de
 * partida for um `timestamptz` do banco (ex.: `created_at`): cortar a string
 * ISO com `.slice(0, 10)` devolve o dia em UTC, que das 21h à meia-noite de
 * Brasília já é o dia seguinte.
 */
export function dateInputInAppTimeZone(instant: Date | string) {
  const parts = new Intl.DateTimeFormat("pt-BR", {
    timeZone: APP_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(typeof instant === "string" ? new Date(instant) : instant);

  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;

  return `${year}-${month}-${day}`;
}

export function todayDateInput() {
  return dateInputInAppTimeZone(new Date());
}

export function currentMonthRef() {
  return `${todayDateInput().slice(0, 7)}-01`;
}

export function toCompetenceMonth(dateString: string) {
  return `${dateString.slice(0, 7)}-01`;
}

export function addMonthsClamped(dateString: string, monthsToAdd: number) {
  const { year, month, day } = parseDateParts(dateString);
  const targetMonth = month - 1 + monthsToAdd;
  const lastDay = new Date(year, targetMonth + 1, 0).getDate();
  return formatDateInput(new Date(year, targetMonth, Math.min(day, lastDay)));
}

export function isPastOrToday(dateString: string) {
  return dateString <= todayDateInput();
}
