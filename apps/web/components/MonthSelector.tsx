import dayjs from "dayjs";

const MONTHS = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
];

const YEARS = [2024, 2025, 2026, 2027];

export default function MonthSelector({
    year,
    month,
    onYearChange,
    onMonthChange,
}: {
    year: number;
    month: number;
    onYearChange: (year: number) => void;
    onMonthChange: (month: number) => void;
}) {
    const monthName = MONTHS[month - 1] ?? "";
    const daysInMonth = dayjs(
        `${year}-${String(month).padStart(2, "0")}-01`,
    ).daysInMonth();
    const firstDayName = dayjs(
        `${year}-${String(month).padStart(2, "0")}-01`,
    ).format("dddd");

    return (
        <div className="mb-2 border-b border-line pb-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                    <p className="mb-1 text-xs font-bold uppercase tracking-widest text-accent">
                        Your garden
                    </p>
                    <h1 className="font-display text-4xl tracking-tight text-ink">
                        {monthName}
                    </h1>
                    <p className="mt-1 text-sm text-muted">
                        {year} · {daysInMonth} days · Week starts {firstDayName}{" "}
                        ☿
                    </p>
                </div>

                <div className="flex items-center gap-3">
                    <div className="flex flex-col gap-0.5">
                        <label className="text-xs font-medium text-muted">
                            Year
                        </label>
                        <select
                            value={year}
                            onChange={(e) =>
                                onYearChange(Number(e.target.value))
                            }
                            className="cursor-pointer rounded-lg border border-line bg-surface px-3 py-1.5 text-sm text-ink outline-none focus:border-accent"
                        >
                            {YEARS.map((y) => (
                                <option key={y} value={y}>
                                    {y}
                                </option>
                            ))}
                        </select>
                    </div>
                    <div className="flex flex-col gap-0.5">
                        <label className="text-xs font-medium text-muted">
                            Month
                        </label>
                        <select
                            value={month}
                            onChange={(e) =>
                                onMonthChange(Number(e.target.value))
                            }
                            className="cursor-pointer rounded-lg border border-line bg-surface px-3 py-1.5 text-sm text-ink outline-none focus:border-accent"
                        >
                            {MONTHS.map((m, i) => (
                                <option key={m} value={i + 1}>
                                    {m}
                                </option>
                            ))}
                        </select>
                    </div>
                </div>
            </div>
        </div>
    );
}
