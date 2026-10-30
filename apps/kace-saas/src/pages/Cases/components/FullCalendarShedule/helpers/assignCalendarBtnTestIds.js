export const assignCalendarButtonTestIds = () => {
    const monthBtn = document.querySelector(".fc-dayGridMonth-button");
    if (monthBtn) {
        monthBtn.setAttribute("data-testid", "btn_month_view");
        monthBtn.id = "btn_month_view";
    }
    const weekBtn = document.querySelector(".fc-timeGridWeek-button");
    if (weekBtn) {
        weekBtn.setAttribute("data-testid", "btn_week_view");
        weekBtn.id = "btn_week_view";
    }
    const dayBtn = document.querySelector(".fc-timeGridDay-button");
    if (dayBtn) {
        dayBtn.setAttribute("data-testid", "btn_day-view");
        dayBtn.id = "btn_day_view";
    }
    const todayBtn = document.querySelector(".fc-today-button");
    if (todayBtn) {
        todayBtn.setAttribute("data-testid", "btn_today_view");
        todayBtn.id = "btn_today_view";
    }
    const nextBtn = document.querySelector(".fc-next-button");
    if (nextBtn) {
        nextBtn.setAttribute("data-testid", "btn_nex_month_view");
        nextBtn.id = "btn_next_month_view";
    }
    const prevBtn = document.querySelector(".fc-prev-button");
    if (prevBtn) {
        prevBtn.setAttribute("data-testid", "btn_prev_month_view");
        prevBtn.id = "btn_prev_month_view";
    }
};
