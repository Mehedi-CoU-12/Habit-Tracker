export default function MonthSelector() {
    return (
        <div className="border-b border-gray-200 pb-6 mb-2">
            <div className="flex items-start justify-between flex-wrap gap-4">
                <div>
                    <p className="text-xs font-semibold text-indigo-500 uppercase tracking-widest mb-1">
                        Habit Tracker
                    </p>
                    <h1 className="text-3xl font-bold text-gray-900 tracking-tight">January</h1>
                    <p className="text-sm text-gray-400 mt-0.5">2026 · 31 days · Week starts Thursday</p>
                </div>

                <div className="flex items-center gap-3">
                    <div className="flex flex-col gap-0.5">
                        <label className="text-xs text-gray-400 font-medium">Year</label>
                        <select className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm text-gray-700 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/20">
                            <option>2026</option>
                            <option>2025</option>
                        </select>
                    </div>
                    <div className="flex flex-col gap-0.5">
                        <label className="text-xs text-gray-400 font-medium">Month</label>
                        <select className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm text-gray-700 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/20">
                            {["January","February","March","April","May","June",
                              "July","August","September","October","November","December"].map((m) => (
                                <option key={m}>{m}</option>
                            ))}
                        </select>
                    </div>
                </div>
            </div>
        </div>
    );
}
