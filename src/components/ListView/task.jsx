import { TaskCheckbox } from 'components/Checkbox'
import { OptionsButton } from 'components/MenuButton'
import { TaskDate } from 'components/task-date'
import { TaskProject } from 'components/TaskProject'
import { useOverlayContextValue } from 'context'
import { useSelectedProject } from 'hooks'
import moment from 'moment'
import { useParams } from 'react-router-dom'
import { getProjectInfo, getProjectTitle } from '../../utils'
import { Draggable } from 'react-beautiful-dnd'

export const Task = ({ name, task, index, projects }) => {
  moment.defaultFormat = 'DD-MM-YYYY'
  const { setShowDialog, setDialogProps } = useOverlayContextValue()

  const { defaultGroup, projectId } = useParams()

  const params = useParams()
  //const { projects } = useProjects();
  const { setSelectedProject, selectedProject } = useSelectedProject(
    params,
    projects,
  )
  const { selectedProjectName } = selectedProject
  let taskProjectName = ''
  let taskProject = {}
  if (selectedProject.defaultProject) {
    taskProjectName = getProjectTitle(projects, task.projectId)
    taskProject = getProjectInfo(projects, task.projectId)
  } else {
    taskProjectName = selectedProjectName
  }

  const menuTriggerHandler = (event, elementPosition) => {
    event.stopPropagation()
    event.preventDefault()
    if (window.innerWidth > 900) {
      return
    }
    setDialogProps(
      Object.assign(
        { elementPosition, taskIsImportant: task.taskIsImportant },
        { taskId: task.taskId, targetIsTask: true },
      ),
    )
    setShowDialog('MENU_LIST')
  }

  return (
    <Draggable draggableId={task.taskId} index={index}>
      {(provided) => (
        <div
          className='task'
          {...provided.dragHandleProps}
          {...provided.draggableProps}
          ref={provided.innerRef}
          onClick={() => {
            setDialogProps({ task, projects })
            setShowDialog('TASK_POPUP')
          }}
        >
          <TaskCheckbox taskId={task?.taskId} />

          <div className='task__details'>
            <p className='task__text'>{name}</p>

            <div className='task__info'>
              <div>{task.date && <TaskDate date={task.date} />} </div>

              <div>
                {' '}
                {defaultGroup && (
                  <TaskProject
                    projectHexColour={taskProject?.projectColour?.hex}
                    projectName={taskProject?.name}
                  />
                )}
              </div>
            </div>
          </div>
          <OptionsButton
            taskId={task.taskId}
            taskIsImportant={task.important}
            targetIsTask
          />
        </div>
      )}
    </Draggable>
  )
}
