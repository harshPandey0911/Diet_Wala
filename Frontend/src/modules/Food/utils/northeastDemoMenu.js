/**
 * Preview-only demo menu for customer 7879363299.
 *
 * When the admin's "Northeast Preview" toggle is ON and this account opens a restaurant
 * whose menu is empty, a demo menu (with working pictures) is shown instead of
 * "Menu is not available yet". It lives only in the browser: nothing is written to the
 * database, other customers never see it, and demo dishes cannot be ordered.
 *
 * To remove the feature later: delete this file and its use in RestaurantDetails.jsx
 * (search for "northeastDemoMenu").
 */
import { loadBusinessSettings } from "@food/utils/businessSettings"

const PREVIEW_PHONE = "7879363299"
const IMG = (file) => `https://dietvala.com/uploads/${file}`

const demoItem = (id, name, price, foodType, image, description, extra = {}) => ({
  id: `demo-${id}`,
  _id: `demo-${id}`,
  name,
  price,
  foodType,
  isVeg: foodType === "Veg",
  image,
  images: [image],
  description,
  variants: [],
  variations: [],
  isAvailable: true,
  isRecommended: false,
  isSpicy: false,
  preparationTime: "15-20 mins",
  isDemo: true,
  ...extra,
})

export const getNortheastDemoMenuSections = () => [
  {
    id: "demo-section-protein",
    name: "High Protein Bowls",
    subsections: [],
    items: [
      demoItem("grilled-chicken", "Grilled Chicken Rice Bowl", 189, "Non-Veg", IMG("img_279fca2867.webp"), "Grilled chicken, brown rice and fresh salad. Approx 480 kcal, 38 g protein.", { isRecommended: true }),
      demoItem("chicken-rice", "Chicken Rice with Salad", 169, "Non-Veg", IMG("img_58faef29ae.webp"), "Lean chicken with steamed rice and seasonal salad. Approx 450 kcal, 34 g protein."),
      demoItem("fish-rice", "Fish Rice Bowl", 179, "Non-Veg", IMG("img_52c7de79ea.webp"), "Pan-seared fish, rice and greens. Approx 410 kcal, 30 g protein."),
    ],
  },
  {
    id: "demo-section-shakes",
    name: "Shakes & Coffee",
    subsections: [],
    items: [
      demoItem("banana-shake", "Banana Protein Shake", 99, "Veg", IMG("img_60d003bb7a.webp"), "Banana, milk and whey blended thick. Approx 280 kcal, 20 g protein."),
      demoItem("cold-coffee", "Cold Coffee", 89, "Veg", IMG("img_42a2cc6b06.webp"), "Chilled coffee with no added sugar. Approx 120 kcal."),
    ],
  },
  {
    id: "demo-section-light",
    name: "Fruits & Snacks",
    subsections: [],
    items: [
      demoItem("fruit-bowl", "Fresh Fruit Salad Bowl", 119, "Veg", IMG("img_4f86f58930.webp"), "Seasonal fruits with a squeeze of lime. Approx 150 kcal."),
      demoItem("energy-bites", "Energy Bite Box", 149, "Veg", IMG("img_52feb20802.webp"), "Dates, nuts and oats energy bites. Approx 320 kcal per box."),
    ],
  },
]

const normalizePhone = (value) => String(value || "").replace(/\D/g, "").slice(-10)

/** True only for customer 7879363299 while the admin's Northeast Preview toggle is ON. */
export const shouldUseNortheastDemoMenu = async (userProfile) => {
  if (normalizePhone(userProfile?.phone || userProfile?.mobile) !== PREVIEW_PHONE) return false
  try {
    const settings = await loadBusinessSettings({ force: true })
    return settings?.northeastUserPreview === true
  } catch {
    return false
  }
}
