import { AccountStatus } from "../../src/lib/api";

const STYLES: Record<AccountStatus, string> = {
    ACTIVE: "bg-green/15 text-green border-green/40",
    PENDING: "bg-amber-500/15 text-amber-600 border-amber-500/40",
    SUSPENDED: "bg-red-500/15 text-red-500 border-red-500/40",
};

const LABELS: Record<AccountStatus, string> = {
    ACTIVE: "Active",
    PENDING: "Pending",
    SUSPENDED: "Suspended",
};

export default function StatusChip({ status }: { status: AccountStatus }) {
    return (
        <span
            className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-bold ${STYLES[status]}`}
        >
            {LABELS[status]}
        </span>
    );
}
