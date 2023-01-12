import { ReactComponent as HamburgerIcon } from 'assets/svg/hamburger.svg'

export const HamburgerButton = (props) => {
  return (
    <div
      role='button'
      onClick={props.onClick}
      className='hamburger_button header-clickable'
    >
      <HamburgerIcon strokeWidth={0.1} />
    </div>
  )
}
