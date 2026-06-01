import { ReactNode } from "react";

export default function OverviewCard({
    title,
    action,
    children,
    className = "",
    bodyClassName = "",
}: {
    title?: string;
    action?: ReactNode;
    children: ReactNode;
    className?: string;
    bodyClassName?: string;
}) {
    return (
        <div
            className={`flex flex-col overflow-hidden rounded-bloom border border-line bg-surface ${className}`}
        >
            {title && (
                <div className="flex items-center justify-between border-b border-line px-5 py-4">
                    <h2 className="font-display text-base text-ink">{title}</h2>
                    {action && <div>{action}</div>}
                </div>
            )}
            <div className={bodyClassName}>{children}</div>
        </div>
    );
}
