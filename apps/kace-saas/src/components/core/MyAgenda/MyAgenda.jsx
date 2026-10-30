import enLocale from '@fullcalendar/core/locales/en-gb'
import esLocale from '@fullcalendar/core/locales/es'
import FullCalendar from '@fullcalendar/react'
import listPlugin from '@fullcalendar/list';
import { useTranslation } from "react-i18next"
import useMyAgenda from "./hooks/useMyAgenda"
import MyAgendaDrawer from "./MyAgendaDrawer"
import { setMyAgendaBehavior } from '../../../redux/state/myAgendaBehavior';
import { useDispatch, useSelector } from "react-redux"
import {
    Drawer,
    DrawerClose,
    DrawerContent,
    DrawerFooter,
} from '../../ui-shared/index'

const MyAgenda = () => {
    const { t } = useTranslation()
    const { data } = useMyAgenda()
    const dispatch = useDispatch()
    const isOpenMyAgenda = useSelector((state) => state.myAgendaBehavior.isOpenMyAgenda)
    const handleOnClose = () => {
        dispatch(setMyAgendaBehavior(false))
    }

    return (
        <Drawer open={isOpenMyAgenda} onOpenChange={handleOnClose} className="pointer-events-auto" id="my_agenda_drawer" data-testid="my_agenda_drawer">
            <DrawerContent
                className="fixed md:right-0 md:left-auto sm:inset-x-0 md:inset-y-0 md:w-80 flex flex-col bg-white h-full shadow-lg"
                classNameOverlay="fixed inset-0 bg-black bg-opacity-50"
                id="my_agenda_drawer_content"
                data-testid="my_agenda_drawer_content"
            >
                <div className="my-agenda mx-auto w-full h-3/4 md:max-w-sm pl-6 pr-4 mt-3">
                    <FullCalendar
                        plugins={[listPlugin]}
                        headerToolbar={{
                            left: "title",
                            center: "",
                            right: "listDay,listWeek,listMonth",
                        }}
                        views={{
                            listDay: { buttonText: t("diary.calendar.button.day") },
                            listWeek: { buttonText: t("diary.calendar.button.week") },
                            listMonth: { buttonText: t("diary.calendar.button.month") },
                        }}
                        locales={[esLocale, enLocale]}
                        locale={t("diary.calendar.language")}
                        initialView="listDay"
                        events={data || []}
                        eventContent={(event) => <MyAgendaDrawer info={event} />}
                    />
                </div>

                <DrawerFooter className="w-full p-5 pl-6 pb-4 mt-5">
                    <DrawerClose asChild>
                        <button
                            className="w-full bg-primary text-white rounded-md p-2 text-2xl md:text-base"
                            variant="outline"
                            onClick={() => handleOnClose()}
                            id="btn_my_agenda_close"
                            data-testid="btn_my_agenda_close"
                        >
                            {t("diary.agenda.button.close")}
                        </button>
                    </DrawerClose>
                </DrawerFooter>
            </DrawerContent>
        </Drawer>
    );
}

export default MyAgenda;

