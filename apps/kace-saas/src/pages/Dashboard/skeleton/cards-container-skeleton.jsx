import { Skeleton } from "@kace/ui-shared"

const CardsContainerSkeleton = () => {
    return (
        <div className="flex gap-8 w-full flex-col justify-center">
            <div className="grid grid-flow-row-dense md:grid-cols-2 xl:grid-rows-1 xl:grid-cols-4 md:grid-rows-2 gap-8">
                <Skeleton className="w-full h-32 rounded-md" />
                <Skeleton className="w-full h-auto rounded-md" />
                <Skeleton className="w-full h-auto rounded-md" />
                <Skeleton className="w-full h-auto rounded-md" />
            </div>
        </div>
    )
}

export default CardsContainerSkeleton
