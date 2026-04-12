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
            className={`rounded-xl border border-gray-200 bg-white overflow-hidden ${className}`}
        >
            {title && (
                <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
                    <h2 className="text-xs font-semibold uppercase tracking-widest text-gray-500">
                        {title}
                    </h2>
                    {action && <div>{action}</div>}
                </div>
            )}
            <div className={bodyClassName}>{children}</div>
        </div>
    );
}
