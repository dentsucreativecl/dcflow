import { cn } from "@/lib/utils"

function Skeleton({
    className,
    ...props
}: React.HTMLAttributes<HTMLDivElement>) {
    return (
        <div
            className={cn("animate-pulse rounded-md bg-muted", className)}
            {...props}
        />
    )
}

// Preset skeleton components
function SkeletonCard() {
    return (
        <div className="space-y-3">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
        </div>
    );
}

function SkeletonAvatar({ size = "md" }: { size?: "sm" | "md" | "lg" }) {
    const sizeClasses = {
        sm: "h-6 w-6",
        md: "h-8 w-8",
        lg: "h-12 w-12",
    };

    return <Skeleton className={cn("rounded-full", sizeClasses[size])} />;
}

function SkeletonText({ lines = 3 }: { lines?: number }) {
    return (
        <div className="space-y-2">
            {Array.from({ length: lines }).map((_, i) => (
                <Skeleton
                    key={i}
                    className={cn(
                        "h-4",
                        i === lines - 1 ? "w-3/4" : "w-full"
                    )}
                />
            ))}
        </div>
    );
}

function SkeletonListRow() {
    return (
        <div className="flex items-center gap-4 px-4 py-3 border-b">
            <Skeleton className="h-4 w-4 rounded" />
            <Skeleton className="h-4 flex-1" />
            <Skeleton className="h-6 w-20 rounded-full" />
            <SkeletonAvatar size="sm" />
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-6 w-16 rounded-full" />
        </div>
    );
}

function SkeletonList({ rows = 5 }: { rows?: number }) {
    return (
        <div className="space-y-0">
            {Array.from({ length: rows }).map((_, i) => (
                <SkeletonListRow key={i} />
            ))}
        </div>
    );
}

export {
    Skeleton,
    SkeletonCard,
    SkeletonAvatar,
    SkeletonText,
    SkeletonListRow,
    SkeletonList,
}
