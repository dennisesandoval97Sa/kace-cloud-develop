import { useNavigate } from "react-router-dom"
import { useTranslation } from "react-i18next"
import { useDispatch } from "react-redux"
import { Ellipsis } from 'lucide-react'
import { format } from 'date-fns'
import { setMyAgendaBehavior } from '../../../redux/state/myAgendaBehavior'
import useMyAgendaDrawer from './hooks/useMyAgendaDrawer'
import {
  Drawer,
  DrawerTrigger,
  DrawerClose,
  DrawerContent,
  DrawerHeader,
  DrawerFooter,
  DrawerTitle,
  DrawerDescription,
  GeneralLoader
} from '../../ui-shared/index'

const MyAgendaDrawer = ({ info }) => {
  const { t } = useTranslation()
  const {
    setStatus,
    agendaInfo,
    caseInfo,
    clientInfo,
    isPendingAgenda,
    isPendingCase,
    isPendingClient,
  } = useMyAgendaDrawer({
    agendaId: info.event?.extendedProps?.agenda_id,
    caseId: info.event?.extendedProps?.case_id
  })
  const dispatch = useDispatch()
  const navigate = useNavigate()
  const start = format(info.event.start, 'HH:mm') || ''
  const end = format(info.event.end, 'HH:mm') || ''
  const initialDate = format(info.event.start, 'dd/MM/yyyy') || ''
  const FinalDate = format(info.event.end, 'dd/MM/yyyy') || ''


  const handleOnClick = () => {
    setStatus(true)
  }

  const handleOnClose = () => {
    navigate(`/agent/update/${info.event?.extendedProps?.case_id}?action=edit`)
    dispatch(setMyAgendaBehavior(false))
  }

  return (
    <Drawer>
      <DrawerTrigger asChild>
        <button
          variant="outline"
          onClick={() => handleOnClick()}
          id="btn_open_my_agenda_drawer"
          data-testid="btn_open_my_agenda_drawer"
        >
          <Ellipsis size={20} />
        </button>
      </DrawerTrigger>
      <DrawerContent
        className="fixed md:right-0 md:left-auto sm:inset-x-0 md:inset-y-0 md:w-80 flex flex-col bg-white shadow-lg h-full md:mt-[45dvh]"
        classNameOverlay="fixed inset-0 bg-black bg-opacity-50"
        id="drawer_my_agenda_container"
        data-testid="drawer_my_agenda_container"
      >
        <div className="mx-auto sm:w-full md:w-96 md:max-w-sm">
          <DrawerHeader className="w-80 p-5" id="drawer_my_agenda_container" data-testid="drawer_my_agenda_container">
            {isPendingAgenda || isPendingCase || isPendingClient ? (
              <div className="flex flex-col items-center justify-start py-[15dvh] min-h-screen bg-background" id="drawer_my_agenda_loader_section" data-testid="drawer_my_agenda_loader_section">
                <GeneralLoader className="" />
                <h2 className="text-2xl font-semibold mt-6 text-foreground">
                  {t("diary.agenda.field.loading")}...
                </h2>
              </div>
            ) : (
              <>
                <DrawerTitle id="drawer_my_agenda_date" data-testid="drawer_my_agenda_date">
                  {t("diary.agenda.field.date")}:{" "}
                  {initialDate !== FinalDate ? `${initialDate} - ${FinalDate}` : initialDate}
                </DrawerTitle>
                <DrawerTitle id="drawer_my_agenda_time" data-testid="drawer_my_agenda_time">
                  {t("diary.agenda.field.time")}: {start} - {end}
                </DrawerTitle>
                <br />

                <DrawerDescription id="drawer_my_agenda_caseid" data-testid="drawer_my_agenda_caseid">
                  {t("diary.agenda.field.caseid")}: {caseInfo?.reference}
                </DrawerDescription>
                <DrawerDescription id="drawer_my_agenda_agenda" data--testid="drawer_my_agenda_agenda">
                  {t("diary.agenda.field.agenda")}: {agendaInfo?.description}
                </DrawerDescription>
                <DrawerDescription id="drawer_my_agenda_client_name" data-testid="drawer_my_agenda_client_name">
                  {t("diary.agenda.field.name")}: {clientInfo?.nombres}
                </DrawerDescription>
                <DrawerDescription id="drawer_agenda_client_type_document" data-testid="drawer_agenda_client_type_document">
                  {t("diary.agenda.field.typedocument")}: {clientInfo?.tipo_documento}
                </DrawerDescription>
                <DrawerDescription id="drawer_my_agenda_client_document" data-testid="drawer_my_agenda_client_document">
                  {t("diary.agenda.field.document")}: {clientInfo?.documento}
                </DrawerDescription>
                <DrawerDescription id="drawer_my_agenda_client_email" data-testid="drawer_my_agenda_client_email">
                  {t("diary.agenda.field.email")}: {clientInfo?.email}
                </DrawerDescription>
              </>
            )}
          </DrawerHeader>

          <DrawerFooter className="w-80 p-5" id="drawer_my_agenda_footer" data-testid="drawer_my_agenda_footer">
            <DrawerClose asChild>
              <button
                className="w-full bg-greenCustom text-white rounded-md p-2"
                onClick={() => handleOnClose()}
                id="btn_open_case_from_my_agenda"
                data-testid="btn_open_case_from_my_agenda"
              >
                {t("diary.agenda.button.case")}
              </button>
            </DrawerClose>
            <DrawerClose asChild>
              <button className="w-full bg-primary text-white rounded-md p-2" variant="outline" id="btn_close_my_agenda_drawer" data-testid="btn_close_my_agenda_drawer">
                {t("diary.agenda.button.close")}
              </button>
            </DrawerClose>
          </DrawerFooter>
        </div>
      </DrawerContent>
    </Drawer>
  );
}

export default MyAgendaDrawer;