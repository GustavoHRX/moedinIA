const APP_TIME_ZONE = "America/Sao_Paulo";

function pad(value: number) {
  return String(value).padStart(2, "0");
}

function parseDateParts(dateString: string) {
  const [year, month, day] = dateString.split("-").map(Number);
  return { year, month, day };
}

export function formatDateInput(date: Date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function todayDateInput() {
  const parts = new Intl.DateTimeFormat("pt-BR", {
    timeZone: APP_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());

  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;

  return `${year}-${month}-${day}`;
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
