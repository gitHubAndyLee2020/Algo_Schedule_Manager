import { ReactComponent as ScheduleIcon } from 'assets/svg/scheduler.svg'
import { SetNewTaskPriorityPopper } from 'components/dropdowns/set-new-task-priority-popper'
import { useOverlayContextValue } from 'context'
import { useState } from 'react'
export const SetNewTaskPriority = ({
  isQuickAdd,
  isPopup,
  setTaskPriority,
  taskPriority,
  task,
}) => {
  const { showDialog, setShowDialog, setDialogProps } = useOverlayContextValue()
  const [showPopup, setShowPopup] = useState(false)
  const [parentPosition, setParentPosition] = useState({})
  const showQUickAddDropDown = (parentPosition) => {
    setParentPosition(parentPosition)
    setShowPopup(true)
  }

  const getPriorityStyle = () => {
    if (taskPriority === 1) {
      let day = 'date__today'
      return day
    }
    if (taskPriority === 2) {
      let day = 'date__weekend'
      return day
    }
    if (taskPriority === 3) {
      let day = 'date__tomorrow'
      return day
    }
    if (taskPriority === 4) {
      let day = 'date__overdue'
      return day
    }
  }

  const getPriorityText = (taskPriority) => {
    if (taskPriority === 1) {
      return 'Low'
    }
    if (taskPriority === 2) {
      return 'Medium'
    }
    if (taskPriority === 3) {
      return 'High'
    }
  }

  return (
    <>
      <div
        className={`set-new-task__schedule ${getPriorityStyle()}`}
        onClick={(e) => {
          setDialogProps(
            Object.assign(
              { elementPosition: e.currentTarget.getBoundingClientRect() },
              { setTaskPriority },
            ),
          )
          if (isPopup) {
            setDialogProps({ task })
            showQUickAddDropDown(e.currentTarget.getBoundingClientRect())
          } else if (isQuickAdd) {
            showQUickAddDropDown(e.currentTarget.getBoundingClientRect())
          } else {
            setShowDialog('SET_TASK_PRIORITY')
          }
        }}
      >
        <ScheduleIcon width={'18px'} height={'18px'} />

        {taskPriority && getPriorityText(taskPriority)}
      </div>
      {showPopup && (
        <SetNewTaskPriorityPopper
          isQuickAdd={isQuickAdd}
          isPopup={isPopup}
          setShowPopup={setShowPopup}
          setTaskPriority={setTaskPriority}
          parentPosition={parentPosition}
        />
      )}
    </>
  )
}
