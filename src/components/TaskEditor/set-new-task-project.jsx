import { ReactComponent as Dot } from 'assets/svg/dot.svg'
import { ReactComponent as InboxIcon } from 'assets/svg/inbox.svg'
import { useOverlayContextValue } from 'context'
import { useProjects, useSelectedProject } from 'hooks'
import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { SetNewTaskProjectPopper } from 'components/dropdowns/set-new-task-project-popper'
export const SetNewTaskProject = ({
  isQuickAdd,
  isChecklist,
  isPopup,
  project,
  setProject,
  projectId,
}) => {
  const params = useParams()
  // const { selectedProject } = useSelectedProjectValue(params);
  const { projects } = useProjects()
  const { selectedProject, defaultGroup } = useSelectedProject(params, projects)
  const [popupSelectedProject, setPopupSelectedProject] =
    useState(selectedProject)
  const { setShowDialog, setDialogProps } = useOverlayContextValue()
  const [showPopup, setShowPopup] = useState(false)
  const [parentPosition, setParentPosition] = useState({})

  const defaultProjectValue = {
    selectedProjectName: 'Inbox',
    selectedProjectId: '',
    defaultProject: true,
  }

  const getChecklistProjectValue = () => {
    const projectMap = {}
    for (const project of projects) {
      projectMap[project.projectId] = project
    }
    if (projectMap.hasOwnProperty(projectId)) {
      const checklistProjectValue = {
        selectedProjectName: projectMap[projectId].name,
        selectedProjectId: projectMap[projectId].projectId,
        defaultProject: false,
        projectColour: projectMap[projectId].projectColour,
      }
      return checklistProjectValue
    } else {
      return defaultProjectValue
    }
  }

  useEffect(() => {
    if (isChecklist) {
      setPopupSelectedProject(getChecklistProjectValue())
    } else if (!project.defaultProject) {
      setPopupSelectedProject(project)
    } else {
      setPopupSelectedProject(defaultProjectValue)
    }
  }, [project])

  useEffect(() => {
    if (isChecklist) {
      setPopupSelectedProject(getChecklistProjectValue())
    } else if (!selectedProject.defaultProject) {
      setProject(selectedProject)
    } else {
      setProject(defaultProjectValue)
    }
  }, [selectedProject])

  const showQUickAddDropDown = (parentPosition) => {
    setParentPosition(parentPosition)
    setShowPopup(true)
  }

  useEffect(() => {
    console.log('isQuickAdd', isQuickAdd) // DEBUGGING
  }, [isQuickAdd])

  useEffect(() => {
    console.log('isPopup', isPopup) // DEBUGGING
  }, [isPopup])

  return (
    <div
      className='set-new-task__project'
      role='button'
      onClick={(e) => {
        setDialogProps(
          Object.assign(
            { elementPosition: e.currentTarget.getBoundingClientRect() },
            { setProject, setPopupSelectedProject },
          ),
        )
        isQuickAdd
          ? showQUickAddDropDown(e.currentTarget.getBoundingClientRect())
          : setShowDialog('SET_PROJECT')
      }}
    >
      {popupSelectedProject?.selectedProjectName === 'Inbox' ? (
        <InboxIcon width='18px' height='18px' fill='#5297ff' />
      ) : (
        <Dot
          color={`${popupSelectedProject?.projectColour?.hex}`}
          width={17}
          height={17}
        />
      )}
      <p className='set-new-task__project--name'>
        {popupSelectedProject.selectedProjectName}
      </p>
      {showPopup && (
        <SetNewTaskProjectPopper
          setShowPopup={setShowPopup}
          project={project}
          setProject={setProject}
          setPopupSelectedProject={setPopupSelectedProject}
          parentPosition={parentPosition}
          isQuickAdd={isQuickAdd}
          isPopup={isPopup}
          showPopup={showPopup}
        />
      )}
    </div>
  )
}
