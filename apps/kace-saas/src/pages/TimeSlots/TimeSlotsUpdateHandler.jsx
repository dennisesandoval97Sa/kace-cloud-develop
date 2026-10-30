import { useEffect, useState } from "react"
import { useParams } from "react-router-dom"
import { initialValues } from "./data"
import TimeSlotsForm from "./components/TimeSlotsForm"
import { GeneralLoader } from "@kace/ui-shared"
import { useTimeSlotUpdate } from "./hooks/useTimeSlotsUpdate"
import { useTimeSlotsData } from "./hooks/useTimeSlotsData"

const TimeSlotsUpdateHandler = () => {
    const { id } = useParams()
    const [timeSlot, setTimeSlot] = useState(initialValues)
    const { handleTimeSlotsUpdate, isSending } = useTimeSlotUpdate()
    const { 
        data, 
        isLoading,
        handleTimeStartChange, 
        handleTimeEndChange  
    } = useTimeSlotsData(id)

    useEffect(() => {
        if (data) setTimeSlot(data)
    }, [data])

    return (
        <>
            {isLoading 
                ? (<GeneralLoader />)
                : (
                    <TimeSlotsForm
                        data={timeSlot}
                        dataHandler={handleTimeSlotsUpdate}
                        isSending={isSending}
                        handleTimeStartChange={handleTimeStartChange}
                        handleTimeEndChange={handleTimeEndChange}  
                    />
                )}
        </>
    )
}

export default TimeSlotsUpdateHandler
