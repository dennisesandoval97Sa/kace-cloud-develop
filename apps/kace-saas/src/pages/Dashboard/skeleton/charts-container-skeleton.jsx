import { Skeleton } from "@kace/ui-shared"

const ChartsContainerSkeleton = () => {
    return (
        <div className="flex flex-col justify-around gap-8">
            <Skeleton className="h-10 w-[350px]" />
            <div className="flex space-x-8">
                <Skeleton className="h-96 w-full rounded-md" />
                <Skeleton className="h-96 w-full rounded-md" />
            </div>
        </div>
    )
}

export default ChartsContainerSkeleton
