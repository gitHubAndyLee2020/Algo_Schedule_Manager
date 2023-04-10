import React, { useState, useRef, useEffect } from 'react'
import 'components/TaskEditor/styles/main.scss'
import 'components/TaskEditor/styles/light.scss'
import { useAutosizeTextArea } from 'hooks'
import { ReactComponent as CopyIcon } from 'assets/svg/copy.svg'
import { ReactComponent as DeleteIcon } from 'assets/svg/trash.svg'
import { ReactComponent as CloseIcon } from 'assets/svg/x.svg'
import { ReactComponent as PlusIcon } from 'assets/svg/plus.svg'
import { ReactComponent as BacklogIcon } from 'assets/svg/backlog.svg'
import { ReactComponent as CheckCircleIcon } from 'assets/svg/check-circle.svg'
import { ReactComponent as RemoveCircleIcon } from 'assets/svg/remove-circle.svg'
import { ReactComponent as QuestionCircleIcon } from 'assets/svg/question-circle.svg'
import { SetProjectColourDropdown } from './ProjectEditor/set-project-colour'
import { GoogleEventColours } from 'handleColorPalette'
import { cropLabel } from 'handleLabel'
import { isValidEmail } from 'handleEmail'
import { ReactComponent as GoogleMeetIcon } from 'assets/svg/google-meet-logo.svg'
import { ReactComponent as ZoomIcon } from 'assets/svg/zoom-logo.svg'
import { RRule } from 'rrule'
import { createGoogleMeet, deleteGoogleMeet } from '../../google'
import { useAuth } from 'hooks'
import moment from 'moment'
import { RecurringEventEdit } from './block/recurring-event-edit'
import { RecurringOptions } from './block/recurring-options'
import { SetNewTaskSchedule } from '../TaskEditor/set-new-task-schedule'
import { SetNewTaskPriority } from '../TaskEditor/set-new-task-priority'

export const Block = ({
  closeOverlay,
  taskname,
  taskdescription,
  taskbackgroundcolor,
  location,
  meetLink,
  attendees,
  recurring,
  start,
  rruleStr,
  eventId,
  calendarId,
  task,
  remove,
  copy,
  backlog,
  save,
}) => {
  const [taskName, setTaskName] = useState(taskname)
  const [taskDescription, setTaskDescription] = useState(taskdescription)
  const textAreaRef = useRef(null)
  const { currentUser } = useAuth()
  const [eventColour, setEventColour] = useState({
    name:
      GoogleEventColours.find(
        (GoogleEventColour) => GoogleEventColour.hex === taskbackgroundcolor,
      )?.name || 'Undefined',
    hex: taskbackgroundcolor,
  })
  const [showSelectColourDropdown, setShowSelectColourDropdown] =
    useState(false)
  const [selectedColour, setSelectedColour] = useState(eventColour)
  const [eventLocation, setEventLocation] = useState(location)
  const [eventMeetLink, setEventMeetLink] = useState(meetLink)
  const [eventAttendees, setEventAttendees] = useState(attendees)
  const [newEventAttendee, setNewEventAttendee] = useState('')
  const [currentUserResponseStatus, setCurrentUserResponseStatus] =
    useState('needsAction')
  const [isRecurring, setIsRecurring] = useState(recurring)
  const [recurringEventEditType, setRecurringEventEditType] = useState('')
  const [recurringEventEditOption, setRecurringEventEditOption] =
    useState('THIS_EVENT')
  const [showRecurringEventOptions, setShowRecurringEventOptions] =
    useState(false)
  const [dtstart, setDtstart] = useState(null) // JS Date object
  const [rrule, setRRule] = useState(null) // RRule object
  // TASK FIELDS: UPDATE THESE LATER
  const [startSchedule, setStartSchedule] = useState({ day: '', date: '' })
  const [endSchedule, setEndSchedule] = useState({ day: '', date: '' })
  const [taskPriority, setTaskPriority] = useState(task?.priority || 2)

  const destructRRuleStr = (rruleStr) => {
    const rruleStrArr = rruleStr.split('\n')
    const rruleStrObj = {
      dtstart: rruleStrArr[0],
      rrule: rruleStrArr[1],
      exdates: rruleStrArr.slice(2),
    }
    return rruleStrObj
  }

  useEffect(() => {
    if (isRecurring) {
      const rruleStrObj = destructRRuleStr(rruleStr)
      const dtstart = moment(rruleStrObj.dtstart.split(':')[1]).toDate()
      const rrule = RRule.fromString(rruleStrObj.rrule)
      setDtstart(dtstart)
      setRRule(rrule)
    }
  }, [])

  useEffect(() => {
    for (const eventAttendee of eventAttendees) {
      if (eventAttendee?.self) {
        setCurrentUserResponseStatus(eventAttendee.responseStatus)
        break
      }
    }
  }, [eventAttendees])

  const getUpdatedEventAttendees = () => {
    const updatedEventAttendees = [...eventAttendees]

    for (const updatedEventAttendee of updatedEventAttendees) {
      if (updatedEventAttendee?.self) {
        updatedEventAttendee.responseStatus = currentUserResponseStatus
        break
      }
    }

    return updatedEventAttendees
  }

  const isUserMeetingOrganizer = () => {
    if (!eventAttendees.some((eventAttendee) => eventAttendee?.self)) {
      return true
    } else {
      return eventAttendees.find((eventAttendee) => eventAttendee?.self)
        ?.organizer
    }
  }

  useEffect(() => {
    setSelectedColour(eventColour)

    return () => {
      setSelectedColour(null)
    }
  }, [eventColour])

  const handleDelete = () => {
    remove(recurringEventEditOption)
    closeOverlay()
  }

  const handleCopy = () => {
    copy()
    closeOverlay()
  }

  const handleBacklog = () => {
    remove(recurringEventEditOption)
    backlog()
    closeOverlay()
  }

  const handleSave = () => {
    save(
      taskName,
      eventColour.hex,
      taskDescription,
      eventLocation,
      eventMeetLink,
      getUpdatedEventAttendees(),
      isRecurring,
      dtstart,
      rrule,
    )
    closeOverlay()
  }

  const handleAddMeetings = async () => {
    const newEventMeetLink = await createGoogleMeet(
      currentUser && currentUser.id,
      calendarId,
      eventId,
    )
    setEventMeetLink(newEventMeetLink)
  }

  useAutosizeTextArea(textAreaRef.current, taskDescription)

  const titleAndOptions = () => {
    return (
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <div style={{ display: 'inline-block' }}>
          <input
            className='add-task__input title'
            value={taskName}
            onChange={(event) => {
              setTaskName(event.target.value)
            }}
            required
            type='text'
            placeholder={`${taskname}`}
          />
        </div>
        <div style={{ display: 'inline-block', textAlign: 'right' }}>
          <BacklogIcon
            className='action-btn'
            onClick={() => {
              if (!isRecurring) {
                handleBacklog()
              } else {
                setRecurringEventEditType('BACKLOG')
              }
            }}
          />
          <CopyIcon className='action-btn' onClick={() => handleCopy()} />
          <DeleteIcon
            className='action-btn'
            onClick={() => {
              if (!isRecurring) {
                handleDelete()
              } else {
                setRecurringEventEditType('DELETE')
              }
            }}
          />
          <CloseIcon className='action-btn' onClick={() => closeOverlay()} />
        </div>
      </div>
    )
  }

  const recurringOptions = () => {
    return (
      <div style={{ marginBottom: '10px' }}>
        <button
          className='recurring-options-button'
          onClick={(e) => {
            e.preventDefault()
            setShowRecurringEventOptions(true)
          }}
        >
          Recurring Options
        </button>
      </div>
    )
  }

  const getAcceptButtonStyle = () => {
    if (currentUserResponseStatus === 'accepted') {
      return { backgroundColor: GoogleEventColours[6].hex }
    } else {
      return {}
    }
  }

  const getDeclineButtonStyle = () => {
    if (currentUserResponseStatus === 'declined') {
      return { backgroundColor: GoogleEventColours[6].hex }
    } else {
      return {}
    }
  }

  const meetingUserResponseStatusButtons = () => {
    if (!eventAttendees.some((eventAttendee) => eventAttendee?.self))
      return null
    return (
      <div style={{ display: 'flex', marginTop: '10px', gap: '10px' }}>
        <button
          onClick={(e) => {
            e.preventDefault()
            setCurrentUserResponseStatus('accepted')
          }}
          style={getAcceptButtonStyle()}
          className='attendee-icon'
        >
          Yes
        </button>
        <button
          onClick={(e) => {
            e.preventDefault()
            setCurrentUserResponseStatus('declined')
          }}
          style={getDeclineButtonStyle()}
          className='attendee-icon'
        >
          No
        </button>
      </div>
    )
  }

  const getMeetingIcon = (url) => {
    if (url.includes('meet.google.com')) {
      return <GoogleMeetIcon strokeWidth='.1' height={24} width={24} />
    } else if (url.includes('zoom.us')) {
      return <ZoomIcon strokeWidth='.1' height={24} width={24} />
    } else {
      return null
    }
  }

  const getJoinButtonText = (url) => {
    if (url.includes('meet.google.com')) {
      return 'Join Google Meet'
    } else if (url.includes('zoom.us')) {
      return 'Join Zoom Meeting'
    } else {
      return 'Join Meeting'
    }
  }

  const getResponseStatusIcon = (responseStatus) => {
    if (responseStatus === 'accepted') {
      return (
        <CheckCircleIcon
          height={16}
          width={16}
          fill={GoogleEventColours[1].hex}
        />
      )
    } else if (responseStatus === 'declined') {
      return (
        <RemoveCircleIcon
          height={16}
          width={16}
          fill={GoogleEventColours[10].hex}
        />
      )
    } else {
      return (
        <QuestionCircleIcon
          height={16}
          width={16}
          fill={GoogleEventColours[4].hex}
        />
      )
    }
  }

  const meetingEditor = () => {
    return (
      <div className='add-project__form-group' role='button'>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            columnGap: '10px',
          }}
        >
          <div style={{ display: 'inline-block' }}>
            <label>Meeting</label>
            {eventMeetLink !== '' ? (
              <div>
                <div
                  className='google-meet-join-button'
                  style={{ cursor: 'pointer' }}
                >
                  {getMeetingIcon(eventMeetLink)}
                  <a
                    href={eventMeetLink}
                    target='_blank'
                    rel='noreferrer'
                    style={{ marginLeft: '5px' }}
                  >
                    {getJoinButtonText(eventMeetLink)}
                  </a>
                  {isUserMeetingOrganizer() && (
                    <CloseIcon
                      height={12}
                      width={12}
                      style={{ marginLeft: '5px' }}
                      onClick={() => {
                        deleteGoogleMeet(
                          currentUser && currentUser.id,
                          calendarId,
                          eventId,
                        )
                        setEventMeetLink('')
                      }}
                    />
                  )}
                </div>
                {meetingUserResponseStatusButtons()}
              </div>
            ) : (
              <div
                className='google-meet-schedule-button'
                style={{ cursor: 'pointer' }}
                onClick={() => handleAddMeetings()}
              >
                <GoogleMeetIcon strokeWidth='.1' height={24} width={24} />
                <p>Add Google Meet</p>
              </div>
            )}
          </div>
          <div style={{ display: 'inline-block' }}>
            <label>Attendees</label>
            {eventAttendees.map(({ displayName, email, responseStatus }, i) => {
              return (
                <div className='attendee-icon'>
                  {getResponseStatusIcon(responseStatus)}
                  <span style={{ marginLeft: '5px' }}>
                    {cropLabel(displayName || email, 30)}
                  </span>
                  {isUserMeetingOrganizer() && (
                    <CloseIcon
                      height={12}
                      width={12}
                      style={{ cursor: 'pointer', marginLeft: '5px' }}
                      onClick={() => {
                        const newAttendees = [...eventAttendees]
                        newAttendees.splice(i, 1)
                        setEventAttendees(newAttendees)
                      }}
                    />
                  )}
                </div>
              )
            })}
            <div style={{ display: 'flex' }}>
              <input
                className='add-task__input--no-bottom-margin'
                type='text'
                placeholder='Add attendee email'
                value={newEventAttendee}
                onChange={(e) => {
                  setNewEventAttendee(e.target.value)
                }}
              />
              <PlusIcon
                onClick={(e) => {
                  e.preventDefault()
                  if (
                    !eventAttendees.some(
                      (eventAttendee) =>
                        eventAttendee.email === newEventAttendee,
                    ) &&
                    isValidEmail(newEventAttendee)
                  ) {
                    const newAttendees = [...eventAttendees]
                    if (newEventAttendee === currentUser?.email) {
                      newAttendees.push({
                        email: newEventAttendee,
                        responseStatus: 'accepted',
                        self: true,
                        organizer: true,
                      })
                    } else {
                      newAttendees.push({
                        email: newEventAttendee,
                        responseStatus: 'needsAction',
                      })
                    }
                    setEventAttendees(newAttendees)
                  }
                  setNewEventAttendee('')
                }}
                style={{ cursor: 'pointer' }}
              />
            </div>
          </div>
        </div>
      </div>
    )
  }

  const locationEditor = () => {
    return (
      <div className='add-project__form-group' role='button'>
        <label>Location</label>
        <input
          className='add-task__input'
          value={eventLocation}
          onChange={(event) => {
            setEventLocation(event.target.value)
          }}
          type='text'
          placeholder='Add location'
        />
      </div>
    )
  }

  const eventColorSelector = () => {
    return (
      <div>
        <div className='add-project__form-group' role='button'>
          <label>Color</label>
          <div
            className='add-project__select-color'
            onClick={() =>
              setShowSelectColourDropdown(!showSelectColourDropdown)
            }
          >
            <span
              className='add-project__selected-color'
              style={{ backgroundColor: `${selectedColour.hex}` }}
            />
            <span className='add-project__selected-color-name'>
              {selectedColour.name}
            </span>
            {showSelectColourDropdown && (
              <SetProjectColourDropdown
                setProjectColour={setEventColour}
                projectColour={eventColour}
                showSelectColourDropdown={showSelectColourDropdown}
                setShowSelectColourDropdown={setShowSelectColourDropdown}
              />
            )}
          </div>
        </div>
      </div>
    )
  }

  const descriptionEditor = () => {
    return (
      <div style={{ marginTop: '20px' }}>
        <textarea
          className='add-task__input textarea'
          value={taskDescription}
          onChange={(e) => setTaskDescription(e.target.value)}
          ref={textAreaRef}
          rows={1}
          type='text'
          placeholder='Write something...'
        />
      </div>
    )
  }

  const taskAttributesEditor = () => {
    return (
      <div style={{ marginTop: '20px' }}>
        <SetNewTaskSchedule
          isQuickAdd={false}
          isPopup={true}
          schedule={startSchedule}
          setSchedule={setStartSchedule}
          task={task}
          defaultText='Start Date'
        />
        <SetNewTaskSchedule
          isQuickAdd={false}
          isPopup={true}
          schedule={endSchedule}
          setSchedule={setEndSchedule}
          task={task}
          defaultText='Due Date'
        />
        <SetNewTaskPriority
          isQuickAdd={false}
          isPopup={true}
          taskPriority={taskPriority}
          setTaskPriority={setTaskPriority}
          task={task}
        />
      </div>
    )
  }

  if (recurringEventEditType !== '') {
    return (
      <RecurringEventEdit
        closeOverlay={closeOverlay}
        recurringEventEditType={recurringEventEditType}
        setRecurringEventEditType={recurringEventEditType}
        recurringEventEditOption={recurringEventEditOption}
        setRecurringEventEditOption={setRecurringEventEditOption}
        handleDelete={handleDelete}
        handleBacklog={handleBacklog}
      />
    )
  }

  if (showRecurringEventOptions) {
    return (
      <RecurringOptions
        closeOverlay={closeOverlay}
        setShowRecurringEventOptions={setShowRecurringEventOptions}
        isRecurring={isRecurring}
        setIsRecurring={setIsRecurring}
        dtstart={recurring ? dtstart : start}
        setDtstart={setDtstart}
        rrule={rrule}
        setRRule={setRRule}
      />
    )
  }

  return (
    <div className='option__overlay' onClick={(event) => closeOverlay(event)}>
      <div
        className='event__wrapper'
        onClick={(event) => {
          event.stopPropagation()
        }}
      >
        <div className='add-task__wrapper'>
          <form className='add-task'>
            <div className={`add-task__container`}>
              {titleAndOptions()}
              {recurringOptions()}
              {meetingEditor()}
              {locationEditor()}
              {eventColorSelector()}
              {descriptionEditor()}
              {task && taskAttributesEditor()}
              <div
                style={{
                  display: 'flex',
                  marginBottom: '10px',
                }}
              >
                <button
                  className=' action add-task__actions--add-task'
                  onClick={(e) => {
                    e.preventDefault()
                    handleSave()
                  }}
                >
                  Save
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
