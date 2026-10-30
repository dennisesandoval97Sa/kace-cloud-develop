import PropTypes from 'prop-types'

const ItemLink = ({ name, icon, open }) => {
  return (
      <div className="w-full flex justify-start items-center">
          <div className="w-5">{icon}</div>
          <div
              className={`transition-all duration-200 delay-200 ${open ? "block" : "hidden"} ml-2`}
          >
              {name}
          </div>
      </div>
  )
}

ItemLink.propTypes = {
  name: PropTypes.string,
  icon: PropTypes.element,
  open: PropTypes.bool,
}

export default ItemLink