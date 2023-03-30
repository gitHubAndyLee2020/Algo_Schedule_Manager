import { CustomProjects } from './custom-projects'
import { DefaultProjects } from './default-projects'
import { useParams } from 'react-router-dom'
import { CalendarList } from './calendar-list'
import { SearchField } from './search-field'
import { useState, useEffect } from 'react'
import { Taskbar } from './task-bar'
import { AutoScheduleButton } from './auto-schedule-button'
import './styles/light.scss'
import './styles/main.scss'

export const Sidebar = (props) => {
  const { defaultGroup } = useParams()
  const [AddTasks, setAddTasks] = useState(false)
  const [FilterTasks, setFilterTasks] = useState(false)
  const [autoSchedule, setAutoSchedule] = useState(false)

  useEffect(() => {
    if (FilterTasks) {
      setAddTasks(false)
      // setFilterTasks(!FilterTasks)
    }
  }, [FilterTasks])

  useEffect(() => {
    if (AddTasks) {
      setFilterTasks(false)
    }
  }, [AddTasks])

  if (defaultGroup === 'Calendar') {
    return (
      <>
        <div className='sidebar__overlay' onClick={props.onClick}></div>
        <aside
          className='sidebar'
          style={{ paddingLeft: '18px', paddingRight: '18px' }}
        >
          <div>
          <button style={{ display: 'flex',
                           fontSize: '25px' }}>
          <Taskbar
                  type='AUTO_SCHEDULE'
                  onOff={true}
                  value={autoSchedule}
                  setValue={setAutoSchedule}
                />
          </button>
            <button style={{ display: 'flex' }}>
              {/* <Taskbar
                  type='ADD_TASKS'
                  value={AddTasks}
                  setValue={setAddTasks}
                /> */}
              <Taskbar
                  type='FILTER_TASKS'
                  onOff={FilterTasks}
                  value={FilterTasks}
                  setValue={setFilterTasks}
                />
            </button>

            <SearchField
              addValue={AddTasks}
              setAddValue={setAddTasks}
              filterValue={FilterTasks}
              setFilterValue={setFilterTasks}
            />
          </div>
          <CalendarList />
          {/* <AutoScheduleButton /> */}
        </aside>
      </>
    )
  }

  return (
    <>
      <div className='sidebar__overlay' onClick={props.onClick}></div>
      <aside className='sidebar'>
        <div className='sidebar-clickables'>
          <DefaultProjects />
        </div>
        <CustomProjects />
      </aside>
    </>
  )
}
