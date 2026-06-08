// Menu Planner tab

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

export default function MenuPage() {
  return (
    <div className="px-4 pt-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-800">🍽️ Menu Planner</h1>
        <p className="text-slate-500 text-sm mt-0.5">This week's meals</p>
      </div>

      {/* Weekly plan */}
      <div className="space-y-2">
        {DAYS.map((day, i) => (
          <div
            key={day}
            className="flex items-center gap-3 p-3.5 bg-white border border-slate-100 rounded-2xl shadow-sm"
          >
            <div className="w-10 text-center">
              <p className="text-xs text-slate-400 font-medium">{day.slice(0, 3).toUpperCase()}</p>
              <p className="text-lg font-bold text-slate-700">{i + 1}</p>
            </div>
            <div className="flex-1">
              <p className="text-slate-400 text-sm italic">No meal planned</p>
            </div>
            <button className="text-emerald-500 text-xl font-light">+</button>
          </div>
        ))}
      </div>

      {/* Sunday planning button */}
      <button className="mt-6 w-full py-4 bg-emerald-500 hover:bg-emerald-600 active:bg-emerald-700 text-white font-semibold rounded-2xl text-base transition-colors shadow-sm">
        ✨ Plan This Week for Me
      </button>

      {/* Recipe hint */}
      <div className="mt-4 p-4 bg-orange-50 border border-orange-200 rounded-2xl flex gap-3">
        <span className="text-2xl">📖</span>
        <div>
          <p className="font-semibold text-orange-800 text-sm">11 family favourites ready</p>
          <p className="text-orange-600 text-xs mt-0.5">Claude will suggest meals based on your pantry</p>
        </div>
      </div>
    </div>
  )
}
