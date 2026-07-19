import { Sparkles } from "lucide-react";

function ComingSoon({ title }) {
  return (
    <div className="p-6">
      <h2 className="text-xl font-bold text-gray-800 mb-1">{title}</h2>
      <div className="bg-white rounded-2xl border border-gray-100 p-16 text-center mt-4">
        <div className="bg-teal-50 text-teal-600 p-3 rounded-full inline-flex mb-3">
          <Sparkles size={22} />
        </div>
        <p className="text-gray-600 font-medium">This feature is coming soon.</p>
        <p className="text-gray-400 text-sm mt-1">We're actively building this out.</p>
      </div>
    </div>
  );
}

export default ComingSoon;