import featherIcon from 'assets/svg/feather-sprite.svg'
import { useThemeContextValue } from 'context'
import { useTaskEditorContextValue } from 'context/board-task-editor-context'
import {
  addDoc,
  collection,
  getDocs,
  query,
  updateDoc,
  where,
} from 'firebase/firestore'
import {
  useAuth,
  useProjects,
  useScheduleCreated,
  useSelectedProject,
  useTasks,
} from 'hooks'
import moment from 'moment'
import React, { useEffect, useState, useRef } from 'react'
import { useParams } from 'react-router-dom'
import { generatePushId } from 'utils'
import { db } from '_firebase'
import { SetNewTaskProject } from './set-new-task-project'
import { SetNewTaskSchedule } from './set-new-task-schedule'
import { SetNewTaskPriority } from './set-new-task-priority'
import { SetNewTaskTimeLength } from './set-new-task-time-length'
import { getTaskDocsInProjectColumnNotCompleted } from '../../handleUserTasks'
import './styles/main.scss'
import './styles/light.scss'
import { updateUserInfo } from 'handleUserInfo'
import { useAutosizeTextArea, useChecklist } from 'hooks'
import useScreenType from 'react-screentype-hook'

export const TaskEditor = ({
  column,
  isQuickAdd,
  isEdit,
  isPopup,
  task,
  closeOverlay,
}) => {
  const params = useParams()
  const { defaultGroup, projectId } = params
  const [startSchedule, setStartSchedule] = useState({ day: '', date: '' })
  const [endSchedule, setEndSchedule] = useState({ day: '', date: '' })
  const { projects } = useProjects()
  const { selectedProject, defaultState } = useSelectedProject(params, projects)
  const { projectIsList } = selectedProject
  const [project, setProject] = useState(
    isQuickAdd ? defaultState : { ...selectedProject },
  )
  const [showAddTaskForm, setShowAddTaskForm] = useState(
    isQuickAdd || isEdit ? true : false,
  )
  const [taskName, setTaskName] = useState(isEdit && task.name)
  const [taskDescription, setTaskDescription] = useState(
    isEdit && task.description,
  )
  const [taskPriority, setTaskPriority] = useState(isEdit && task.priority)
  const [taskTimeLength, setTaskTimeLength] = useState(
    isEdit && task.timeLength,
  )
  const { currentUser } = useAuth()
  const [disabled, setDisabled] = useState(true)
  const { taskEditorToShow, setTaskEditorToShow } = useTaskEditorContextValue()
  const { isLight } = useThemeContextValue()
  const { tasks } = useTasks()
  const { scheduleCreated } = useScheduleCreated()
  const { checklist } = useChecklist()
  const screenType = useScreenType()
  const textAreaRef = useRef(null)

  useAutosizeTextArea(textAreaRef.current, taskDescription)

  const getBoardStatus = () => {
    if (!projectIsList && column) {
      return column.id
    } else {
      return 'NOSECTION'
    }
  }

  const getMaxIndex = (tasks, boardStatus) => {
    const currentColumnTaskIds = tasks
      .filter((task) => task.boardStatus === boardStatus)
      .map((task) => task.index)
    if (currentColumnTaskIds.length === 0) {
      return -1
    } else {
      return Math.max(...currentColumnTaskIds)
    }
  }

  const getValidStartDate = (startDate, endDate) => {
    if (startDate === '') {
      return ''
    } else {
      if (
        moment(startDate, 'DD-MM-YYYY').isAfter(moment(endDate, 'DD-MM-YYYY'))
      ) {
        return endDate
      } else {
        return startDate
      }
    }
  }

  const addTaskToFirestore = async (event) => {
    event.preventDefault()
    const taskId = generatePushId()
    const boardStatus = getBoardStatus()

    let index = 0
    if (defaultGroup === 'Checklist') {
      try {
        const newChecklist = Array.from(checklist)
        newChecklist.push(taskId)
        await updateUserInfo(currentUser && currentUser.id, {
          checklist: newChecklist,
        })
      } catch (error) {
        console.log(error)
      }
    } else if (defaultGroup === 'Scheduled') {
      const inboxTaskDocs = await getTaskDocsInProjectColumnNotCompleted(
        currentUser && currentUser.id,
        '',
        'NOSECTION',
      )
      const newProjectTasks = []
      inboxTaskDocs.forEach((taskDoc) => {
        newProjectTasks.push(taskDoc.data())
      })

      if (newProjectTasks.length > 0) {
        const maxIndex = Math.max(...newProjectTasks.map((task) => task.index))
        index = maxIndex + 1
      }
    } else {
      index = getMaxIndex(tasks, boardStatus) + 1
    }
    // UPDATE TASK INDEX HERE (COMPLETED)
    try {
      resetForm()

      await addDoc(
        collection(db, 'user', `${currentUser && currentUser.id}/tasks`),
        {
          projectId: project.selectedProjectId || '',
          startDate: getValidStartDate(startSchedule.date, endSchedule.date),
          date: endSchedule.date,
          name: taskName,
          taskId: taskId,
          completed: false,
          boardStatus: boardStatus,
          important: defaultGroup === 'Important' ? true : false,
          description: taskDescription ? taskDescription : '', // string
          priority: taskPriority, // number (int) (range: 1-3)
          timeLength: taskTimeLength, // number (int) (range: 15-480)
          index: index,
        },
      )
      // UPDATE TASK INDEX HERE (COMPLETED)
      if (scheduleCreated) {
        updateUserInfo(currentUser && currentUser.id, {
          scheduleCreated: false,
        })
      }
    } catch (error) {
      console.log(error)
    }
  }

  const resetForm = (event) => {
    event?.preventDefault()
    setProject({ ...selectedProject })
    isQuickAdd && closeOverlay()
    setTaskName('')
    setTaskDescription('')
    setTaskPriority(2)
    setTaskTimeLength(60)
    setStartSchedule({ day: '', date: '' })
    /*The default day is 'Today' only for the Scheduled*/
    if (defaultGroup === 'Scheduled') {
      setEndSchedule({ day: 'Today', date: moment().format('DD-MM-YYYY') })
    } else {
      setEndSchedule({ day: '', date: '' })
    }
    setTaskEditorToShow('')
  }

  const showAddTaskFormHandler = (event) => {
    resetForm(event)
    setTaskEditorToShow(column?.id || '')
    setShowAddTaskForm(!showAddTaskForm)
  }
  const handleChange = (e) => {
    e.target.value.length < 1 ? setDisabled(true) : setDisabled(false)
  }

  const getNewProjectId = () => {
    if (defaultGroup === 'Checklist' || defaultGroup === 'Scheduled') {
      return task.projectId
    } else if (project.selectedProjectName !== task.projectId) {
      return project.selectedProjectId
    } else {
      return task.projectId
    }
  }

  const updateTaskInFirestore = async (e) => {
    e.preventDefault()
    try {
      const taskQuery = await query(
        collection(db, 'user', `${currentUser && currentUser.id}/tasks`),
        where('taskId', '==', task.taskId),
      )
      const taskDocs = await getDocs(taskQuery)
      const newProjectId = getNewProjectId()
      // UPDATE BOARDSTATUS HERE (COMPLETED)
      let newBoardStatus = task.boardStatus
      let newIndex = task.index

      if (task.projectId !== newProjectId) {
        const newProjectIsInbox = newProjectId === ''

        if (newProjectIsInbox) {
          newBoardStatus = 'NOSECTION'
        } else {
          const currentProject = projects.find(
            (project) => project.projectId === task.projectId,
          )
          const newProject = projects.find(
            (project) => project.projectId === newProjectId,
          )
          let currentColumnTitle = '(No Section)'
          if (task.projectId !== '') {
            currentColumnTitle = currentProject.columns.find(
              (column) => column.id === task.boardStatus,
            ).title
          }
          const columnTitleInNewProject = newProject.columns
            .map((column) => column.title)
            .includes(currentColumnTitle)
          if (!columnTitleInNewProject) {
            newBoardStatus = 'NOSECTION'
          } else {
            newBoardStatus = newProject.columns.find(
              (column) => column.title === currentColumnTitle,
            ).id
          }
        }

        const newProjectTaskDocs = await getTaskDocsInProjectColumnNotCompleted(
          currentUser && currentUser.id,
          newProjectId,
          newBoardStatus,
        )

        const newProjectTasks = []
        newProjectTaskDocs.forEach((taskDoc) => {
          newProjectTasks.push(taskDoc.data())
        })

        newIndex = 0
        if (newProjectTasks.length > 0) {
          const maxIndex = Math.max(
            ...newProjectTasks.map((task) => task.index),
          )
          newIndex = maxIndex + 1
        }

        const currentProjectTaskDocs =
          await getTaskDocsInProjectColumnNotCompleted(
            currentUser && currentUser.id,
            task.projectId,
            task.boardStatus,
          )

        currentProjectTaskDocs.forEach(async (taskDoc) => {
          if (taskDoc.data().index > task.index) {
            await updateDoc(taskDoc.ref, {
              index: taskDoc.data().index - 1,
            })
          }
        })
      }

      taskDocs.forEach(async (taskDoc) => {
        await updateDoc(taskDoc.ref, {
          name: taskName,
          startDate: getValidStartDate(startSchedule.date, endSchedule.date),
          date: endSchedule.date,
          projectId: newProjectId,
          description: taskDescription, // string
          priority: taskPriority, // number (int) (range: 1-3)
          timeLength: taskTimeLength, // number (int) (range: 15-480)
          boardStatus: newBoardStatus,
          index: newIndex,
        })
      })

      if (scheduleCreated) {
        updateUserInfo(currentUser && currentUser.id, {
          scheduleCreated: false,
        })
      }
    } catch (error) {
      console.log(error)
    }
    setTaskEditorToShow('')
    isPopup && closeOverlay()
  }

  const { defaultProject } = selectedProject

  useEffect(() => {
    if (defaultGroup || isQuickAdd) {
      setProject({
        selectedProjectId: '',
        selectedProjectName: 'Inbox',
        defaultProject,
      })
    } else {
      setProject({ ...selectedProject })
    }
    if (isEdit) {
      moment.defaultFormat = 'DD-MM-YYYY'
      setStartSchedule({
        day:
          task.startDate.length > 1
            ? moment(task.startDate, moment.defaultFormat).format('MMM DD')
            : '',
        date: task.startDate,
      })
      setEndSchedule({
        day:
          task.date.length > 1
            ? moment(task.date, moment.defaultFormat).format('MMM DD')
            : '',
        date: task.date,
      })
    }
    if (!taskPriority) {
      setTaskPriority(2)
    } else {
      setTaskPriority(taskPriority)
    }
    if (!taskTimeLength && taskTimeLength !== 0) setTaskTimeLength(60)
  }, [defaultGroup])

  useEffect(() => {
    if (taskEditorToShow === 'NEW') {
      setShowAddTaskForm(true)
    }
  }, [taskEditorToShow])

  const splitTaskAttributes = () => {
    if (isPopup || isQuickAdd) {
      return screenType.isMobile
    } else if (defaultGroup) {
      return screenType.isMobile
    } else {
      return !projectIsList || screenType.isMobile
    }
  }

  return (
    <div
      className={`add-task__wrapper ${isQuickAdd && 'quick-add__wrapper'}`}
      onClick={(event) => {
        event.stopPropagation()
      }}
    >
      {!showAddTaskForm ? (
        <div
          className='add-task__toggle'
          onClick={(event) => {
            event.stopPropagation()
            showAddTaskFormHandler(event)
          }}
        >
          <div className='add-task__icon'>
            <svg width='19' height='19' fill='none' strokeLinejoin='round'>
              <use xlinkHref={`${featherIcon}#plus`}></use>
            </svg>
          </div>
          <span>Add Task</span>
        </div>
      ) : (
        <></>
      )}
      {showAddTaskForm && (
        <form
          className='add-task'
          onSubmit={(event) =>
            isEdit ? updateTaskInFirestore(event) : addTaskToFirestore(event)
          }
          style={{ width: `${isQuickAdd ? '100%' : ''}` }}
        >
          <div
            className={`add-task__container${projectIsList ? '--list' : ''} ${
              isQuickAdd ? ' quick-add__container' : ''
            }`}
          >
            <input
              className={`add-task__input title${
                projectIsList ? '--list' : ''
              }`}
              value={taskName}
              onChange={(event) => {
                handleChange(event)
                setTaskName(event.target.value)
              }}
              required
              type='text'
              placeholder={'Some Title...'}
            />

            <textarea
              className='add-task__input textarea'
              value={taskDescription}
              onChange={(e) => setTaskDescription(e.target.value)}
              ref={textAreaRef}
              rows={1}
              type='text'
              placeholder='Some description...'
            />
            <div
              className='add-task__attributes'
              style={{ marginBottom: '10px' }}
            >
              <div className='add-task__attributes--left'>
                {defaultGroup !== 'Checklist' &&
                  defaultGroup !== 'Scheduled' && (
                    <SetNewTaskProject
                      isQuickAdd={isQuickAdd}
                      isPopup={isPopup}
                      project={project}
                      setProject={setProject}
                      task={task}
                    />
                  )}
              </div>
              <div className='add-task__attributes--right'></div>
            </div>
            <div
              style={{
                display: 'flex',
                flexDirection: splitTaskAttributes() ? 'column' : 'row',
              }}
            >
              <div
                className='add-task__attributes'
                style={{
                  marginRight: splitTaskAttributes() ? '0px' : '6px',
                  marginBottom: splitTaskAttributes() ? '10px' : '0px',
                }}
              >
                <div className='add-task__attributes--left'>
                  <SetNewTaskSchedule
                    isQuickAdd={isQuickAdd}
                    isPopup={isPopup}
                    schedule={startSchedule}
                    setSchedule={setStartSchedule}
                    task={task}
                    defaultText='Start Date'
                  />
                  <SetNewTaskSchedule
                    isQuickAdd={isQuickAdd}
                    isPopup={isPopup}
                    schedule={endSchedule}
                    setSchedule={setEndSchedule}
                    task={task}
                    defaultText='Due Date'
                  />
                </div>
                <div className='add-task__attributes--right'></div>
              </div>
              <div className='add-task__attributes'>
                <div className='add-task__attributes--left'>
                  <SetNewTaskPriority
                    isQuickAdd={isQuickAdd}
                    isPopup={isPopup}
                    taskPriority={taskPriority}
                    setTaskPriority={setTaskPriority}
                    task={task}
                  />
                  <SetNewTaskTimeLength
                    isQuickAdd={isQuickAdd}
                    isPopup={isPopup}
                    taskTimeLength={taskTimeLength}
                    setTaskTimeLength={setTaskTimeLength}
                    task={task}
                  />
                </div>
                <div className='add-task__attributes--right'></div>
              </div>
            </div>
          </div>
          <div
            className={`add-task__actions ${
              isQuickAdd || isPopup ? 'quick-add__actions' : ''
            }`}
          >
            <button
              className=' action add-task__actions--add-task'
              type='submit'
              disabled={isEdit ? false : disabled}
            >
              {isEdit ? 'Save' : 'Add task'}
            </button>
            <button
              className={` action  ${
                isLight ? 'action__cancel' : 'action__cancel--dark'
              }`}
              onClick={(event) => {
                if (isQuickAdd || isPopup) {
                  closeOverlay()
                } else {
                  showAddTaskFormHandler(event)
                }
              }}
            >
              Cancel
            </button>
          </div>
        </form>
      )}
    </div>
  )
}
