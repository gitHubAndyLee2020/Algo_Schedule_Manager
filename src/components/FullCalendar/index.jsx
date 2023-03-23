import { useRef, useEffect, useState } from 'react'
import { Calendar } from '@fullcalendar/core'
import dayGridPlugin from '@fullcalendar/daygrid'
import timeGridPlugin from '@fullcalendar/timegrid'
import rrulePlugin from '@fullcalendar/rrule'
import interactionPlugin, { Draggable } from '@fullcalendar/interaction'
import { useExternalEventsContextValue } from 'context'
import { generateEventId } from '../../utils'
import googleCalendarPlugin from '@fullcalendar/google-calendar'
import {
  getUserGoogleCalendarsEvents,
  addEventToUserGoogleCalendar,
  deleteEventFromUserGoogleCalendar,
  updateEventFromUserGoogleCalendar,
  addWebhookToGoogleCalendar,
} from '../../google'
import {
  useGoogleValue,
  useCalendarsEventsValue,
  useThemeContextValue,
} from 'context'
import { useAuth, useUnselectedCalendarIds } from 'hooks'
import moment from 'moment'
import './calendar.scss'
import { timeZone } from 'handleCalendars'
import { RRule } from 'rrule'
import {
  getEventsInfo,
  updateEventsInfo,
} from '../../backend/handleUserEventsInfo'
import { quickAddTask } from '../../backend/handleUserTasks'
import {
  GoogleEventColours,
  isValidGoogleEventColorId,
} from '../../handleColorPalette'
import { useOverlayContextValue } from 'context'
import { stripTags } from '../../handleHTML'
import { generatePushId } from 'utils'

const USER_SELECTED_CALENDAR = 'primary'

export const FullCalendar = () => {
  const calendarRef = useRef(null)
  const { externalEventsRef } = useExternalEventsContextValue()
  const [currentTime, setCurrentTime] = useState(new Date())
  const { googleCalendars } = useGoogleValue()
  const { currentUser } = useAuth()
  const { unselectedCalendarIds } = useUnselectedCalendarIds()
  const { calendarsEvents, setCalendarsEvents } = useCalendarsEventsValue()
  const [nextSyncTokens, setNextSyncTokens] = useState({})
  const [resourceIds, setResourceIds] = useState({})
  const { isLight } = useThemeContextValue()
  const { setShowDialog, setDialogProps } = useOverlayContextValue()

  useEffect(() => {
    const ws = new WebSocket(
      `wss://${process.env.REACT_APP_NGROK_BODY}/webhooks/google/calendar`,
    )

    ws.addEventListener('open', (event) => {
      console.log('WebSocket connection established')
    })

    ws.addEventListener('message', (event) => {
      console.log(`Received message: ${event.data}`)
    })

    return () => {
      ws.close()
    }
  }, [])

  const getEventCalendarId = (eventId) => {
    let calendarId = null
    for (const key in calendarsEvents) {
      if (
        calendarsEvents[key].find(
          (calendarEvent) => calendarEvent.id === eventId,
        )
      ) {
        if (key === 'custom') {
          calendarId = USER_SELECTED_CALENDAR
        } else {
          calendarId = key
        }
        break
      }
    }
    return calendarId
  }

  const getSelectedCalendarsEvents = (mixedCalendarsEvents) => {
    let events = []
    for (const key in mixedCalendarsEvents) {
      if (!unselectedCalendarIds.includes(key)) {
        events = events.concat(mixedCalendarsEvents[key])
      }
    }

    return events
  }

  const mapWeekday = (weekday) => {
    const mapping = ['mo', 'tu', 'we', 'th', 'fr', 'sa', 'su']
    return mapping[weekday]
  }

  const mapFreq = (freq) => {
    const mapping = ['yearly', 'monthly', 'weekly', 'daily']
    return mapping[freq]
  }

  useEffect(() => {
    const fetchGoogleCalendarEvents = async () => {
      const cachedCalendarsEvents = localStorage.getItem(
        'algo_calendars_events',
      )
      if (cachedCalendarsEvents) {
        setCalendarsEvents(JSON.parse(cachedCalendarsEvents))
      }

      const googleCalendarIds = googleCalendars.map(
        (googleCalendar) => googleCalendar.id,
      )
      const { fetchedCalendarsEvents, nextSyncTokens } =
        await getUserGoogleCalendarsEvents(
          currentUser && currentUser.id,
          googleCalendarIds,
        )
      setNextSyncTokens(nextSyncTokens)
      const newCalendarsEvents = { ...calendarsEvents }
      for (const key in fetchedCalendarsEvents) {
        const eventsData = fetchedCalendarsEvents[key].map((event) => {
          /* MEETING INFO START */
          // // Assuming 'event' is a valid Google Calendar API event object
          // const meetingInfo = {}
          // // Get the list of attendees
          // if (event.attendees) {
          // }

          // meetingInfo.attendees = event.attendees.map(function (attendee) {
          //   return attendee.email
          // })

          // // Get the summary, location, and description of the event
          // meetingInfo.location = event.location

          // // Get the start and end times of the event
          // meetingInfo.startTime = event.start.dateTime
          // meetingInfo.endTime = event.end.dateTime

          // // Check if the event has a Google Meet link
          // if (event.conferenceData && event.conferenceData.entryPoints) {
          //   // Get the Google Meet link from the event object
          //   meetingInfo.meetLink = event.conferenceData.entryPoints[0].uri
          // }

          // // Log the meeting information
          // console.log(meetingInfo)
          /* MEETING INFO END */

          if (event.recurrence) {
            const rule = new RRule.fromString(
              event.recurrence[event.recurrence.length - 1],
            )
            const recurrenceObject = rule.origOptions

            const recurringEvent = {
              id: event.id,
              title: event.summary,
              rrule: {
                freq: mapFreq(recurrenceObject.freq),
                dtstart: event.start?.dateTime || event.start?.date,
              },
              url: event.htmlLink,
              taskId: event?.extendedProperties?.shared?.taskId,
              description: stripTags(event?.description || ''),
              backgroundColor: isValidGoogleEventColorId(event.colorId)
                ? GoogleEventColours[event.colorId - 1].hex
                : GoogleEventColours[6].hex,
            }

            if (recurrenceObject.interval) {
              recurringEvent.rrule.interval = recurrenceObject.interval
            }

            if (recurrenceObject.byweekday) {
              recurringEvent.rrule.byweekday = recurrenceObject.byweekday.map(
                ({ weekday }) => mapWeekday(weekday),
              )
            }

            if (recurrenceObject.until) {
              recurringEvent.rrule.until = moment(
                recurrenceObject.until,
              ).format('YYYY-MM-DD')
            }

            return recurringEvent
          } else {
            const nonRecurringEvent = {
              id: event.id,
              title: event.summary,
              start: event.start?.dateTime || event.start?.date,
              end: event.end?.dateTime || event.end?.date,
              url: event.htmlLink,
              taskId: event?.extendedProperties?.shared?.taskId,
              description: stripTags(event?.description || ''),
              backgroundColor: isValidGoogleEventColorId(event.colorId)
                ? GoogleEventColours[event.colorId - 1].hex
                : GoogleEventColours[6].hex,
            }

            return nonRecurringEvent
          }
        })

        newCalendarsEvents[key] = eventsData
      }
      setCalendarsEvents(newCalendarsEvents)

      // cache the events
      localStorage.setItem(
        'algo_calendars_events',
        JSON.stringify(newCalendarsEvents),
      )
    }

    if (currentUser && googleCalendars.length > 0) {
      fetchGoogleCalendarEvents()
      const fetchedResourceIds = {}
      googleCalendars.forEach(async (googleCalendar) => {
        const result = await addWebhookToGoogleCalendar(
          currentUser.id,
          googleCalendar.id,
        )
        fetchedResourceIds[googleCalendar.id] = result.resourceId
      })
      setResourceIds(fetchedResourceIds)
    }
  }, [currentUser, googleCalendars])

  const showEventPopup = (info, calendar) => {
    info.jsEvent.preventDefault()

    const taskname = info.event.title
    const taskdescription = info.event.extendedProps?.description
    const start = new Date(info.event.start)
    const end = new Date(info.event.end)

    setDialogProps({
      allDay: info.event.allDay,
      taskname: taskname,
      taskdescription: taskdescription,
      taskbackgroundcolor: info.event.backgroundColor,
      remove: () => {
        const newCalendarsEvents = { ...calendarsEvents }
        for (const key in newCalendarsEvents) {
          newCalendarsEvents[key] = newCalendarsEvents[key].filter(
            (event) => event.id !== info.event.id,
          )
        }

        setCalendarsEvents(newCalendarsEvents)
        // remove from calendar
        info.event.remove()

        /* find the id of calendar that the event belongs to */
        const calendarId = getEventCalendarId(info.event.id)

        // delete from Google Calendar
        deleteEventFromUserGoogleCalendar(
          currentUser.id,
          calendarId,
          info.event.id,
        )
      },
      copy: () => {
        const id = generateEventId()
        const newEvent = {
          end: info.event.endStr,
          id: id,
          start: info.event.startStr,
          title: info.event.title,
          backgroundColor: info.event.backgroundColor,
        }

        setCalendarsEvents({
          ...calendarsEvents,
          custom: [...calendarsEvents.custom, newEvent],
        })
        calendar.addEvent(newEvent)

        // add to Google Calendar
        const newGoogleCalendarEvent = {
          id: id,
          summary: info.event.title,
          start: !info.event.allDay
            ? {
                dateTime: info.event.startStr,
                timeZone: timeZone,
              }
            : {
                date: info.event.startStr,
              },
          end: !info.event.allDay
            ? {
                dateTime: info.event.endStr,
                timeZone: timeZone,
              }
            : {
                date: info.event.endStr,
              },
        }

        // add to Google Calendar
        addEventToUserGoogleCalendar(
          currentUser.id,
          USER_SELECTED_CALENDAR,
          newGoogleCalendarEvent,
        )
      },
      backlog: async () => {
        const id = info.event.extendedProps?.taskId

        if (id) {
          /* if id exists, then remove it from scheduledTasks array in Firestore */
          const eventsInfo = await getEventsInfo(currentUser.id)
          const scheduledTasks = eventsInfo.scheduledTasks
          const newScheduledTasks = scheduledTasks.filter(
            (taskId) => taskId !== info.event.extendedProps.taskId,
          )
          updateEventsInfo(currentUser.id, {
            scheduledTasks: newScheduledTasks,
          })
        } else {
          /* if id does not exists, then create a quick task, and add it to notScheduledTasks array in Firestore */
          const taskId = generatePushId()
          const taskTimeLength = moment(info.event.end).diff(
            moment(info.event.start),
            'minutes',
          )

          await quickAddTask(
            currentUser.id,
            taskname,
            taskId,
            taskdescription,
            taskTimeLength,
          )
        }
      },
      save: (
        taskName,
        taskDescription,
        startDate,
        endDate,
        backgroundColor,
      ) => {
        if (endDate <= startDate) {
          endDate = moment(startDate).add(15, 'minutes').toDate()
        }

        // update the event in FullCalendar
        info.event.setProp('title', taskName)
        info.event.setStart(startDate)
        info.event.setEnd(endDate)
        info.event.setProp('backgroundColor', backgroundColor)
        info.event.setExtendedProp('description', taskDescription)

        const calendarId = getEventCalendarId(info.event.id)
        const calendarsEventsKey =
          calendarId === 'primary' ? 'custom' : calendarId

        // update the event in calendarsEvents
        const newCalendarsEvents = { ...calendarsEvents }
        newCalendarsEvents[calendarsEventsKey] = newCalendarsEvents[
          calendarsEventsKey
        ].map((event) => {
          if (event.id === info.event.id) {
            return {
              ...event,
              title: taskName,
              start: startDate,
              end: endDate,
              backgroundColor: backgroundColor,
              description: taskDescription,
            }
          } else {
            return event
          }
        })

        // update the event in Google Calendar
        const updatedGoogleCalendarEvent = {
          summary: taskName,
          description: taskDescription,
          start: !info.event.allDay
            ? {
                dateTime: startDate.toISOString(),
                timeZone: timeZone,
              }
            : {
                date: startDate.toISOString().slice(0, 10),
              },
          end: !info.event.allDay
            ? {
                dateTime: endDate.toISOString(),
                timeZone: timeZone,
              }
            : {
                date: endDate.toISOString().slice(0, 10),
              },
          colorId:
            GoogleEventColours.findIndex(
              (colour) => colour.hex === backgroundColor,
            ) + 1,
        }

        updateEventFromUserGoogleCalendar(
          currentUser.id,
          calendarId,
          info.event.id,
          updatedGoogleCalendarEvent,
        )
      },
      start: start,
      end: end,
    })
    setShowDialog('BLOCK')
  }

  function formatEventTimeLength(timeLength) {
    console.log('timeLength', timeLength)

    const minutes = timeLength

    // Calculate hours and minutes
    const hours = Math.floor(minutes / 60)
    const remainingMinutes = minutes % 60

    // Format as HH:MM
    const formattedHours = ('0' + hours).slice(-2)
    const formattedMinutes = ('0' + remainingMinutes).slice(-2)

    console.log('formattedTimeLength', formattedHours + ':' + formattedMinutes)

    return formattedHours + ':' + formattedMinutes
  }

  useEffect(() => {
    const externalEvents = new Draggable(externalEventsRef.current, {
      itemSelector: '.fc-event',
      eventData: function (eventEl) {
        const draggedEvent = JSON.parse(eventEl.dataset.event)
        return {
          id: generateEventId(),
          title: eventEl.innerText,
          duration: formatEventTimeLength(draggedEvent.timeLength),
          backgroundColor: draggedEvent.backgroundColor,
        }
      },
    })

    if (!currentUser) return null

    const calendar = new Calendar(calendarRef.current, {
      height: 'calc(100vh - 64px)',
      plugins: [
        rrulePlugin,
        dayGridPlugin,
        timeGridPlugin,
        interactionPlugin,
        googleCalendarPlugin,
      ],
      headerToolbar: {
        left: 'prev,next today',
        center: 'title',
        right: 'dayGridMonth,timeGridWeek,timeGridDay',
      },
      editable: true,
      droppable: true,
      dayMaxEventRows: true,
      views: {
        timeGrid: {
          dayMaxEventRows: 3, // adjust to 6 only for timeGridWeek/timeGridDay
        },
      },
      // scrollTimeReset: false,
      // scrollTime: null,
      selectable: true,
      initialView: 'timeGridWeek', // set the default view to timeGridWeek
      slotDuration: '00:15:00',
      slotLabelInterval: '01:00:00',
      googleCalendarApiKey: process.env.REACT_APP_GOOGLE_API_KEY, // replace with your API key
      drop: async function (info) {
        const draggedEvent = JSON.parse(info.draggedEl.dataset.event)

        const id = generateEventId()

        // add to FullCalendar
        const newEvent = {
          id: id,
          title: draggedEvent.name,
          start: info.date,
          allDay: info.allDay,
          end: moment(info.date)
            .add(draggedEvent.timeLength, 'minutes')
            .toDate(),
          taskId: draggedEvent.taskId,
          description: draggedEvent.description,
          backgroundColor: draggedEvent.backgroundColor,
        }
        setCalendarsEvents({
          ...calendarsEvents,
          custom: [...calendarsEvents.custom, newEvent],
        })

        const newGoogleCalendarEvent = {
          id: id,
          summary: draggedEvent.name,
          description: draggedEvent.description,
          start: !info.allDay
            ? {
                dateTime: info.dateStr,
                timeZone: timeZone,
              }
            : {
                date: info.dateStr,
              },
          end: !info.allDay
            ? {
                dateTime: moment(info.date)
                  .add(draggedEvent.timeLength, 'minutes')
                  .toISOString(),
                timeZone: timeZone,
              }
            : {
                date: moment(info.dateStr, 'YYYY-MM-DD')
                  .add(1, 'days')
                  .format('YYYY-MM-DD'),
              },
          extendedProperties: {
            shared: {
              taskId: draggedEvent.taskId,
            },
          },
          colorId:
            GoogleEventColours.findIndex(
              (colour) => colour.hex === draggedEvent.backgroundColor,
            ) + 1,
        }

        // add to Google Calendar
        addEventToUserGoogleCalendar(
          currentUser.id,
          USER_SELECTED_CALENDAR,
          newGoogleCalendarEvent,
        )

        /* stores the taskId to scheduledTasks array in eventsInfo collection */
        const eventsInfo = await getEventsInfo(currentUser.id)
        const scheduledTasks = eventsInfo.scheduledTasks
        const newScheduledTasks = [...scheduledTasks, draggedEvent.taskId]
        updateEventsInfo(currentUser.id, {
          scheduledTasks: newScheduledTasks,
        })
      },
      eventClick: function (info) {
        showEventPopup(info, calendar)
      },
      select: function (info) {
        const id = generateEventId()

        // add to FullCalendar
        const newEvent = {
          id: id,
          title: 'New Event',
          start: info.startStr,
          end: info.endStr,
          taskId: null,
          description: '',
          backgroundColor: GoogleEventColours[6].hex,
        }

        setCalendarsEvents({
          ...calendarsEvents,
          custom: [...calendarsEvents.custom, newEvent],
        })

        // add to Google Calendar
        const newGoogleCalendarEvent = {
          id: id,
          summary: 'New Event',
          start: !info.allDay
            ? {
                dateTime: info.startStr,
                timeZone: timeZone,
              }
            : {
                date: info.startStr,
              },
          end: !info.allDay
            ? {
                dateTime: info.endStr,
                timeZone: timeZone,
              }
            : {
                date: info.endStr,
              },
        }

        // add to Google Calendar
        addEventToUserGoogleCalendar(
          currentUser.id,
          USER_SELECTED_CALENDAR,
          newGoogleCalendarEvent,
        )
      },
      eventResize: function (eventResizeInfo) {
        const { event } = eventResizeInfo

        const updatedGoogleCalendarEvent = {
          start: !event.allDay
            ? {
                dateTime: event.startStr,
                timeZone: timeZone,
              }
            : {
                date: event.startStr,
              },
          end: !event.allDay
            ? {
                dateTime: event.endStr,
                timeZone: timeZone,
              }
            : {
                date: event.endStr,
              },
        }

        const calendarId = getEventCalendarId(event.id)

        updateEventFromUserGoogleCalendar(
          currentUser.id,
          calendarId,
          event.id,
          updatedGoogleCalendarEvent,
        )
      },
      eventDrop: function (eventDropInfo) {
        const { event } = eventDropInfo

        const updatedGoogleCalendarEvent = {
          start: !event.allDay
            ? {
                dateTime: event.startStr,
                timeZone: timeZone,
              }
            : {
                date: event.startStr,
              },
          end: !event.allDay
            ? {
                dateTime: event.endStr,
                timeZone: timeZone,
              }
            : {
                date: event.endStr,
              },
        }

        const calendarId = getEventCalendarId(event.id)

        updateEventFromUserGoogleCalendar(
          currentUser.id,
          calendarId,
          event.id,
          updatedGoogleCalendarEvent,
        )
      },
      events: getSelectedCalendarsEvents(calendarsEvents),
      now: new Date(), // set the current time
      nowIndicator: true, // display a red line through the current time
      handleWindowResize: true,
      eventBorderColor: isLight ? '#fff' : '#1f1f1f',
    })

    calendar.render()

    // Update the current time every 5 minutes
    const intervalId = setInterval(() => {
      setCurrentTime(new Date())
    }, 5 * 60 * 1000) // 5 minutes in milliseconds

    return () => {
      calendar.destroy()
      externalEvents.destroy()
      clearInterval(intervalId)
    }
  }, [
    isLight,
    calendarsEvents,
    unselectedCalendarIds,
    externalEventsRef,
    currentTime,
    googleCalendars,
  ])

  return <div ref={calendarRef}></div>
}
