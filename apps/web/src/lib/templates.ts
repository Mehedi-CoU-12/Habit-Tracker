export interface HabitTemplate {
    id: string;
    name: string;
    description: string;
    emoji: string;
    color: string; // Tailwind bg class for the icon badge
    habits: Array<{ name: string; goal: number }>;
}

export const HABIT_TEMPLATES: HabitTemplate[] = [
    {
        id: "morning-routine",
        name: "Morning Routine",
        description: "Start each day with purpose and energy",
        emoji: "🌅",
        color: "bg-orange-100 text-orange-600",
        habits: [
            { name: "Wake up early", goal: 25 },
            { name: "Drink water", goal: 30 },
            { name: "Exercise", goal: 20 },
            { name: "Meditate", goal: 20 },
            { name: "Journal", goal: 15 },
        ],
    },
    {
        id: "fitness",
        name: "Fitness",
        description: "Build a stronger, healthier body",
        emoji: "💪",
        color: "bg-red-100 text-red-600",
        habits: [
            { name: "Workout", goal: 20 },
            { name: "Walk 10k steps", goal: 25 },
            { name: "Stretch", goal: 20 },
            { name: "Sleep 8 hours", goal: 28 },
        ],
    },
    {
        id: "study",
        name: "Study & Focus",
        description: "Sharpen your mind and build knowledge",
        emoji: "📚",
        color: "bg-blue-100 text-blue-600",
        habits: [
            { name: "Study 1 hour", goal: 22 },
            { name: "Read 20 pages", goal: 20 },
            { name: "No social media", goal: 20 },
            { name: "Review notes", goal: 18 },
        ],
    },
    {
        id: "health",
        name: "Health & Wellness",
        description: "Nourish your body every day",
        emoji: "🥗",
        color: "bg-green-100 text-green-600",
        habits: [
            { name: "Drink 8 glasses of water", goal: 28 },
            { name: "Sleep 8 hours", goal: 28 },
            { name: "Take vitamins", goal: 28 },
            { name: "No junk food", goal: 22 },
        ],
    },
    {
        id: "mindfulness",
        name: "Mindfulness",
        description: "Find calm and clarity daily",
        emoji: "🧘",
        color: "bg-purple-100 text-purple-600",
        habits: [
            { name: "Meditate", goal: 20 },
            { name: "Gratitude journal", goal: 20 },
            { name: "Digital detox 1 hour", goal: 22 },
            { name: "Deep breathing", goal: 20 },
        ],
    },
];
