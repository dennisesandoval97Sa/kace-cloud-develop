import { TrendingUp, ChartPie } from "lucide-react"
import { Label, Pie, PieChart } from "recharts"
import PropTypes from "prop-types"

import {
    Card,
    CardContent,
    CardDescription,
    CardFooter,
    CardHeader,
    CardTitle
} from "../ui/card"
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "../ui/chart"
import { useMemo } from "react"

export function PieChartDonut ({
    chartConfig,
    chartData,
    textFooterOne,
    title,
    description,
    textFooterTwo
}) {
    const totalVisitors = useMemo(() => {
        return chartData.reduce((acc, curr) => acc + curr.total, 0)
    }, [chartData])

    return (
        <Card className="flex flex-col max-h-96">
            <CardHeader className="items-center pb-0">
                <CardTitle>{title}</CardTitle>
                <CardDescription>{description}</CardDescription>
            </CardHeader>
            <CardContent className="flex-1 pb-0">
                <ChartContainer
                    config={chartConfig}
                    className="mx-auto aspect-square max-h-[250px]"
                >
                    {totalVisitors === 0 && (
                        <div className="flex items-center justify-center gap-4 mt-16">
                            <ChartPie className="h-16 w-16" />
                            <p className="text-muted-foreground text-2xl">
                                No data
                            </p>
                        </div>
                    )}
                    <PieChart>
                        <ChartTooltip
                            cursor={false}
                            content={
                                <ChartTooltipContent
                                    hideLabel
                                    className="w-40"
                                />
                            }
                        />
                        <Pie
                            data={chartData}
                            dataKey="total"
                            nameKey="label"
                            innerRadius={60}
                            strokeWidth={5}
                        >
                            <Label
                                content={({ viewBox }) => {
                                    if (
                                        viewBox &&
                                        "cx" in viewBox &&
                                        "cy" in viewBox
                                    ) {
                                        return (
                                            <text
                                                x={viewBox.cx}
                                                y={viewBox.cy}
                                                textAnchor="middle"
                                                dominantBaseline="middle"
                                            >
                                                <tspan
                                                    x={viewBox.cx}
                                                    y={viewBox.cy}
                                                    className="fill-foreground text-3xl font-bold"
                                                >
                                                    {totalVisitors.toLocaleString()}
                                                </tspan>
                                                <tspan
                                                    x={viewBox.cx}
                                                    y={(viewBox.cy || 0) + 24}
                                                    className="fill-muted-foreground"
                                                >
                                                    Total
                                                </tspan>
                                            </text>
                                        )
                                    }
                                }}
                            />
                        </Pie>
                    </PieChart>
                </ChartContainer>
            </CardContent>
            <CardFooter className="flex-col gap-2 text-sm">
                <div className="flex items-center gap-2 font-medium leading-none">
                    {textFooterOne} <TrendingUp className="h-4 w-4" />
                </div>
                <div className="leading-none text-muted-foreground">
                    {textFooterTwo}
                </div>
            </CardFooter>
        </Card>
    )
}

PieChartDonut.propTypes = {
    chartConfig: PropTypes.object,
    chartData: PropTypes.array,
    textFooterOne: PropTypes.string,
    title: PropTypes.string,
    description: PropTypes.string,
    textFooterTwo: PropTypes.string
}
