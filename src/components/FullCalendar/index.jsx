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
import { useAuth, useUnselectedCalendarIds, useTasks } from 'hooks'
import moment from 'moment'
import './calendar.scss'
import { timeZone } from 'handleCalendars'
import {
  getEventsInfo,
  updateEventsInfo,
} from '../../backend/handleUserEventsInfo'
import { quickAddTask, handleCheckTask } from '../../backend/handleUserTasks'
import {
  GoogleEventColours,
  isValidGoogleEventColorId,
} from '../../handleColorPalette'
import { useOverlayContextValue } from 'context'
import { stripTags } from '../../handleHTML'
import { generatePushId } from 'utils'
import {
  getFormattedEventTime,
  formatEventTimeLength,
  getRecurringEventDuration,
} from './eventTimeHelpers'
import {
  getFormattedRRule,
  getRRuleAndExdates,
  updateDtStartInRRuleStr,
} from './rruleHelpers'
import { NonRecurringEvent, RecurringEvent } from './event'

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
  const { tasks } = useTasks()

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

  useEffect(() => {
    const fetchGoogleCalendarEvents = async () => {
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

      const deletedEventInstances = {}

      for (const key in fetchedCalendarsEvents) {
        fetchedCalendarsEvents[key].forEach((event) => {
          if (event.status === 'cancelled') {
            const formattedEventTime = getFormattedEventTime(
              event.originalStartTime?.dateTime,
              event.originalStartTime?.date,
            )
            if (
              !Object.keys(deletedEventInstances).includes(
                event.id.split('_')[0],
              )
            ) {
              deletedEventInstances[event.id.split('_')[0]] = [
                formattedEventTime,
              ]
            } else {
              deletedEventInstances[event.id.split('_')[0]].push(
                formattedEventTime,
              )
            }
          }
        })
      }

      for (const key in fetchedCalendarsEvents) {
        const eventsData = fetchedCalendarsEvents[key].map((event) => {
          const id = event.id
          const title = event.summary
          const backgroundColor = isValidGoogleEventColorId(event.colorId)
            ? GoogleEventColours[event.colorId - 1].hex
            : GoogleEventColours[6].hex
          const description = stripTags(event?.description || '')
          const location = event?.location || ''
          const meetLink = event.conferenceData?.entryPoints[0].uri || ''
          const attendees = event?.attendees || []
          const taskId = event?.extendedProperties?.private?.taskId || null

          const start = event.start?.dateTime || event.start?.date

          if (event.recurrence) {
            const allDay = event.start?.dateTime ? false : true
            const rruleAndExdates = getRRuleAndExdates(event.recurrence, allDay)
            const dtStart = getFormattedEventTime(start, allDay)
            const recurrence = event.recurrence
            const eventEnd = event.end?.dateTime || event.end?.date
            const duration = getRecurringEventDuration(start, eventEnd)
            const formattedDuration = formatEventTimeLength(duration)
            const formattedRRule = getFormattedRRule(
              dtStart,
              rruleAndExdates.rrule,
              [
                ...(deletedEventInstances[event.id] || []),
                ...rruleAndExdates.exdates,
              ],
            )

            const recurringEvent = new RecurringEvent(
              id,
              title,
              backgroundColor,
              description,
              location,
              meetLink,
              attendees,
              taskId,
              formattedRRule,
              formattedDuration,
              dtStart,
              recurrence,
            )

            return recurringEvent
          } else {
            const end = event.end?.dateTime || event.end?.date

            const nonRecurringEvent = new NonRecurringEvent(
              id,
              title,
              backgroundColor,
              description,
              location,
              meetLink,
              attendees,
              taskId,
              start,
              end,
            )

            return nonRecurringEvent
          }
        })

        newCalendarsEvents[key] = eventsData
      }

      setCalendarsEvents(newCalendarsEvents)
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

  const getTask = (taskId) => {
    return tasks.find((task) => task.taskId === taskId)
  }

  const handleRecurringEventAdjustment = (info) => {
    const { event, oldEvent } = info

    const oldStart = oldEvent.start
    const start = event.start

    // if event is dragged to a new day, then return early
    if (
      moment(oldStart).format('YYYY-MM-DD') !==
      moment(start).format('YYYY-MM-DD')
    ) {
      info.revert()
      alert('Recurring events cannot be dragged to a new day.')
      return
    }

    const end = event.end
    const change = moment(start).diff(moment(oldStart), 'minutes')
    const duration = moment(end).diff(moment(start), 'minutes')
    const formattedDuration = formatEventTimeLength(duration)

    const dtStart = event.extendedProps?.dtStart || ''
    const dtStartTime = moment(dtStart)
    const newDtStartTime = dtStartTime.clone().add(change, 'minutes')
    const newDtEndTime = newDtStartTime.clone().add(duration, 'minutes')
    const rruleStr = event.extendedProps?.rruleStr || ''
    const formattedNewDtstart = getFormattedEventTime(newDtStartTime)
    const newRRuleStr = updateDtStartInRRuleStr(rruleStr, formattedNewDtstart)
    const recurrence = event.extendedProps?.recurrence || []

    const calendarId = getEventCalendarId(event.id)

    setCalendarsEvents((prevCalendarsEvents) => {
      const newCalendarsEvents = { ...prevCalendarsEvents }
      const events = newCalendarsEvents[calendarId]
      const newEvents = events.map((prevEvent) => {
        if (prevEvent.id === event.id) {
          prevEvent.updateRecurringFields(
            newRRuleStr,
            formattedDuration,
            formattedNewDtstart,
            recurrence,
          )
        }
        return prevEvent
      })
      newCalendarsEvents[calendarId] = newEvents
      return newCalendarsEvents
    })

    const updatedGoogleCalendarEvent = {
      start: !event.allDay
        ? {
            dateTime: newDtStartTime.toISOString(),
            timeZone: timeZone,
          }
        : {
            date: newDtStartTime.toISOString(),
          },
      end: !event.allDay
        ? {
            dateTime: newDtEndTime.toISOString(),
            timeZone: timeZone,
          }
        : {
            date: newDtEndTime.toISOString(),
          },
    }

    updateEventFromUserGoogleCalendar(
      currentUser.id,
      calendarId,
      event.id,
      updatedGoogleCalendarEvent,
    )
  }

  const handleNonRecurringEventAdjustment = (info) => {
    const { event } = info

    const calendarId = getEventCalendarId(event.id)

    setCalendarsEvents((prevCalendarsEvents) => {
      const newCalendarsEvents = { ...prevCalendarsEvents }
      const events = newCalendarsEvents[calendarId]
      const newEvents = events.map((prevEvent) => {
        if (prevEvent.id === event.id) {
          prevEvent.updateNonRecurringFields(event.start, event.end)
        }
        return prevEvent
      })
      newCalendarsEvents[calendarId] = newEvents
      return newCalendarsEvents
    })

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

    updateEventFromUserGoogleCalendar(
      currentUser.id,
      calendarId,
      event.id,
      updatedGoogleCalendarEvent,
    )
  }

  const handleEventAdjustment = (info) => {
    const recurring = info.event.extendedProps?.recurring

    if (recurring) {
      handleRecurringEventAdjustment(info)
    } else {
      handleNonRecurringEventAdjustment(info)
    }
  }

  const showEventPopup = (info, calendar) => {
    info.jsEvent.preventDefault()

    console.log('info.event', info.event) // DEBUGGING

    const recurring = info.event.extendedProps?.recurring

    const taskId = info.event.extendedProps?.taskId
    const task = getTask(taskId)

    const allDay = info.event.allDay
    const title = info.event.title
    const description = info.event.extendedProps?.description
    const backgroundColor = info.event.backgroundColor
    const start = info.event.start
    const end = info.event.end
    const duration = moment(end).diff(moment(start), 'minutes')
    const formattedDuration = formatEventTimeLength(duration)

    const location = info.event.extendedProps?.location || ''
    const meetLink = info.event.extendedProps?.meetLink || ''
    const attendees = info.event.extendedProps?.attendees || []
    const rruleStr = info.event.extendedProps?.rruleStr || ''
    const recurrence = info.event.extendedProps?.recurrence || []
    const dtStart = info.event.extendedProps?.dtStart || ''
    const dtStartTime = moment(dtStart)
    const dtEndTime = dtStartTime.clone().add(duration, 'minutes')

    const recurrenceId = getFormattedEventTime(start, allDay)

    const calendarId = getEventCalendarId(info.event.id)
    const eventId = info.event.id

    setDialogProps({
      taskname: title,
      taskdescription: description,
      taskbackgroundcolor: backgroundColor,
      location: location,
      meetLink: meetLink,
      attendees: attendees,
      rruleStr: rruleStr,
      eventId: eventId,
      calendarId: calendarId,
      task: task,
      remove: (recurringEventEditOption) => {
        /* find the id of calendar that the event belongs to */
        const calendarId = getEventCalendarId(info.event.id)
        const calendarsEventsKey =
          calendarId === 'primary' ? 'custom' : calendarId

        const exdate = `EXDATE;TZID=${timeZone}:${recurrenceId}`
        const newRecurrence = [...recurrence, exdate]

        if (recurring && recurringEventEditOption === 'THIS_EVENT') {
          const newRRule = rruleStr + '\nEXDATE:' + recurrenceId

          // update at calendarsEvents
          let updatedEvent = null

          const newCalendarsEvents = { ...calendarsEvents }
          newCalendarsEvents[calendarsEventsKey] = newCalendarsEvents[
            calendarsEventsKey
          ].map((prevEvent) => {
            if (prevEvent.id === info.event.id) {
              prevEvent.updateRecurringFields(
                newRRule,
                formattedDuration,
                dtStart,
                newRecurrence,
              )
            }
            return prevEvent
          })

          setCalendarsEvents(newCalendarsEvents)

          info.event.remove()
          if (updatedEvent) {
            calendar.addEvent(updatedEvent)
          }

          const updatedGoogleCalendarEvent = {
            recurrence: newRecurrence,
          }

          // update at Google Calendar
          updateEventFromUserGoogleCalendar(
            currentUser.id,
            calendarId,
            info.event.id,
            updatedGoogleCalendarEvent,
          )
        } else {
          // remove from calendarsEvents
          const newCalendarsEvents = { ...calendarsEvents }
          for (const key in newCalendarsEvents) {
            newCalendarsEvents[key] = newCalendarsEvents[key].filter(
              (event) => event.id !== info.event.id,
            )
          }

          setCalendarsEvents(newCalendarsEvents)

          // remove from FullCalendar
          info.event.remove()

          // remove from Google Calendar
          deleteEventFromUserGoogleCalendar(
            currentUser.id,
            calendarId,
            info.event.id,
          )
        }
      },
      copy: () => {
        const id = generateEventId()

        let newEvent = null
        let newGoogleCalendarEvent = null

        if (recurring) {
          newEvent = new RecurringEvent(
            id,
            title,
            backgroundColor,
            description,
            location,
            meetLink,
            attendees,
            taskId,
            rruleStr,
            formattedDuration,
            dtStart,
            recurrence,
          )

          newGoogleCalendarEvent = {
            id: id,
            summary: info.event.title,
            start: !info.event.allDay
              ? {
                  dateTime: dtStartTime.toISOString(),
                  timeZone: timeZone,
                }
              : {
                  date: dtStartTime.toISOString(),
                },
            end: !info.event.allDay
              ? {
                  dateTime: dtEndTime.toISOString(),
                  timeZone: timeZone,
                }
              : {
                  date: dtEndTime.toISOString(),
                },
            recurrence: recurrence,
          }
        } else {
          newEvent = new NonRecurringEvent(
            id,
            title,
            backgroundColor,
            description,
            location,
            meetLink,
            attendees,
            taskId,
            start,
            end,
          )

          newGoogleCalendarEvent = {
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
        }

        setCalendarsEvents({
          ...calendarsEvents,
          custom: [...calendarsEvents.custom, newEvent],
        })
        calendar.addEvent(newEvent)

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
            title,
            taskId,
            description,
            taskTimeLength,
            'DUPLICATE',
          )
        }
      },
      save: (
        taskName,
        taskDescription,
        backgroundColor,
        location,
        meetLink,
        attendees,
        dtstart, // JS Date object
        rrule, // RRule object
      ) => {
        console.log('dtstart', dtstart) // DEBUGGING
        console.log('rrule', rrule) // DEBUGGING

        const allDay = info.event.allDay
        const recurrence = info.event.extendedProps?.recurrence

        const rruleStr = rrule.toString()
        const dtstartStrFullCalendar = getFormattedEventTime(dtstart)
        const dtstartStrGoogleCalendar = allDay
          ? dtstart.toISOString().slice(0, 10)
          : dtstart.toISOString()
        console.log('dtstartStrFullCalendar', dtstartStrFullCalendar) // DEBUGGING
        console.log('dtstartStrGoogleCalendar', dtstartStrGoogleCalendar) // DEBUGGING

        const rruleAndExdates = getRRuleAndExdates(recurrence, allDay)
        const newRecurrence = [...rruleAndExdates.exdates, rruleStr]

        // update the event in FullCalendar
        info.event.setProp('title', taskName)
        info.event.setProp('backgroundColor', backgroundColor)
        info.event.setExtendedProp('description', taskDescription)
        info.event.setExtendedProp('location', location)
        info.event.setExtendedProp('meetLink', meetLink)
        info.event.setExtendedProp('attendees', attendees)
        info.event.setExtendedProp('rruleStr', rruleStr)
        info.event.setExtendedProp('dtStart', dtstartStrFullCalendar)
        info.event.setExtendedProp('recurrence', newRecurrence)

        const calendarId = getEventCalendarId(info.event.id)
        const calendarsEventsKey =
          calendarId === 'primary' ? 'custom' : calendarId

        // update the event in calendarsEvents
        const newCalendarsEvents = { ...calendarsEvents }
        newCalendarsEvents[calendarsEventsKey] = newCalendarsEvents[
          calendarsEventsKey
        ].map((event) => {
          if (event.id === info.event.id) {
            const updatedEvent = {
              ...event,
              title: taskName,
              backgroundColor: backgroundColor,
              description: taskDescription,
            }
            if (attendees.length > 0) {
              updatedEvent.attendees = attendees
            }
            return updatedEvent
          } else {
            return event
          }
        })

        setCalendarsEvents(newCalendarsEvents)

        // adjust the start and end date such that it is in the same day as the original event

        // update the event in Google Calendar
        const updatedGoogleCalendarEvent = {
          summary: taskName,
          description: taskDescription,
          colorId:
            GoogleEventColours.findIndex(
              (colour) => colour.hex === backgroundColor,
            ) + 1,
          attendees: attendees,
          recurrence: newRecurrence,
          start: allDay
            ? {
                date: dtstartStrGoogleCalendar,
                timeZone: timeZone,
              }
            : {
                dateTime: dtstartStrGoogleCalendar,
                timeZone: timeZone,
              },
        }

        updateEventFromUserGoogleCalendar(
          currentUser.id,
          calendarId,
          info.event.id,
          updatedGoogleCalendarEvent,
        )
      },
    })
    setShowDialog('BLOCK')
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
        const title = draggedEvent.name
        const description = draggedEvent.description
        const backgroundColor = draggedEvent.backgroundColor
        const taskId = draggedEvent.taskId
        const start = info.date
        const end = moment(info.date)
          .add(draggedEvent.timeLength, 'minutes')
          .toDate()
        const location = ''
        const meetLink = ''
        const attendees = []

        const newEvent = new NonRecurringEvent(
          id,
          title,
          backgroundColor,
          description,
          location,
          meetLink,
          attendees,
          taskId,
          start,
          end,
        )

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
            private: {
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

        const newEvent = new NonRecurringEvent(
          id,
          'New Event',
          GoogleEventColours[6].hex,
          '',
          '',
          '',
          [],
          null,
          info.startStr,
          info.endStr,
        )

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
      eventResize: function (info) {
        handleEventAdjustment(info)
      },
      eventDrop: function (info) {
        handleEventAdjustment(info)
      },
      events: getSelectedCalendarsEvents(calendarsEvents),
      eventContent: function (info) {
        // create a div to hold the event content
        const eventEl = document.createElement('div')
        eventEl.classList.add('fc-event')

        // create a span to hold the event time range
        const timeRangeEl = document.createElement('p')
        timeRangeEl.classList.add('fc-event-time-range')
        timeRangeEl.innerText = info.timeText
        eventEl.appendChild(timeRangeEl)

        const taskId = info.event.extendedProps?.taskId

        if (taskId) {
          // create a checkbox for the checkmark
          const checkmarkInput = document.createElement('input')
          checkmarkInput.type = 'checkbox'
          checkmarkInput.classList.add('checkmark-input')
          const task = tasks.find((task) => task.taskId === taskId)
          if (task?.boardStatus === 'COMPLETE') {
            checkmarkInput.checked = true
          }
          eventEl.appendChild(checkmarkInput)

          // attach an onClick event listener to the checkbox
          checkmarkInput.addEventListener('click', function () {
            handleCheckTask(currentUser.id, taskId)
          })
        }

        // create a span to hold the event title
        const titleEl = document.createElement('span')
        titleEl.classList.add('fc-event-title')
        titleEl.innerText = info.event.title
        eventEl.appendChild(titleEl)

        return { domNodes: [eventEl] }
      },
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
