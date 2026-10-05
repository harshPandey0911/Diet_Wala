import { useState, useRef, useEffect } from "react"
import useRestaurantBackNavigation from "@food/hooks/useRestaurantBackNavigation"
import { ArrowLeft } from "lucide-react"
import { ImageSourcePicker } from "@food/components/ImageSourcePicker"
import { isFlutterBridgeAvailable } from "@food/utils/imageUploadUtils"
import { restaurantAPI, uploadAPI } from "@food/api"
import { toast } from "sonner"
import { getImageValidationError } from '@/shared/utils/uploadErrors.js'

const FSSAI_NUMBER_REGEX = /^\d{14}$/
const sanitizeFssai = (value = "") => String(value).replace(/\D/g, "").slice(0, 14)
const toDateInputValue = (value) => {
  if (!value) return ""
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? "" : date.toISOString().split("T")[0]
}

export default function FssaiUpdate() {
  const goBack = useRestaurantBackNavigation()
  const [fssaiNumber, setFssaiNumber] = useState("")
  const [fssaiExpiry, setFssaiExpiry] = useState("")
  const [existingImageUrl, setExistingImageUrl] = useState("")
  const [uploadedFile, setUploadedFile] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [isPhotoPickerOpen, setIsPhotoPickerOpen] = useState(false)
  const fileInputRef = useRef(null)

  useEffect(() => {
    restaurantAPI.getCurrentRestaurant()
      .then((response) => {
        const data = response?.data?.data?.restaurant || response?.data?.restaurant
        if (!data) return
        setFssaiNumber(sanitizeFssai(data.fssaiNumber || ""))
        setFssaiExpiry(toDateInputValue(data.fssaiExpiry))
        setExistingImageUrl(data.fssaiImage?.url || data.fssaiImage || "")
      })
      .catch(() => {})
  }, [])

  const handleFileSelect = (file) => {
    if (file) {
      const isPdf = file.type === "application/pdf"
      const validationError = isPdf
        ? (file.size > 5 * 1024 * 1024 ? "File must be up to 5MB" : null)
        : getImageValidationError(file)
      if (validationError) {
        toast.error(validationError)
        return
      }
      setUploadedFile(file)
    }
  }

  const handleFileClick = () => {
    if (isFlutterBridgeAvailable()) {
      setIsPhotoPickerOpen(true)
    } else {
      fileInputRef.current?.click()
    }
  }

  const isNumberValid = FSSAI_NUMBER_REGEX.test(fssaiNumber)
  const hasDocument = Boolean(uploadedFile || existingImageUrl)
  const canSubmit = isNumberValid && hasDocument && !submitting

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!isNumberValid) {
      toast.error("FSSAI number must contain exactly 14 digits")
      return
    }
    if (!hasDocument) {
      toast.error("Please upload your FSSAI license")
      return
    }

    try {
      setSubmitting(true)
      let fssaiImage = existingImageUrl
      if (uploadedFile) {
        const uploadResponse = uploadedFile.type === "application/pdf"
          ? await uploadAPI.uploadFile(uploadedFile, { folder: "fssai" })
          : await uploadAPI.uploadMedia(uploadedFile, { folder: "fssai" })
        fssaiImage = uploadResponse?.data?.data?.url || uploadResponse?.data?.url || ""
        if (!fssaiImage) throw new Error("License upload failed")
      }

      await restaurantAPI.updateProfile({ fssaiNumber, fssaiExpiry, fssaiImage })
      toast.success("FSSAI details submitted for admin approval")
      goBack()
    } catch (error) {
      toast.error(error?.userMessage || error?.response?.data?.message || error?.message || "Failed to update FSSAI details")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-full bg-white flex flex-col">
      {/* Header */}
      <div className="px-4 pt-4 pb-3 flex items-center gap-3 border-b border-gray-200">
        <button
          onClick={goBack}
          className="p-2 rounded-full hover:bg-gray-100"
          aria-label="Back"
        >
          <ArrowLeft className="w-5 h-5 text-gray-900" />
        </button>
        <h1 className="text-base font-semibold text-gray-900">Update FSSAI</h1>
      </div>

      <form onSubmit={handleSubmit} id="fssai-form" className="flex-1 px-4 pt-4 pb-28 space-y-4">
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">
            FSSAI registration number
          </label>
          <input
            type="text"
            inputMode="numeric"
            maxLength={14}
            value={fssaiNumber}
            onChange={(e) => setFssaiNumber(sanitizeFssai(e.target.value))}
            placeholder="eg. 19138110019201"
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-black focus:border-black"
          />
          <p className={`text-xs mt-1 ${fssaiNumber && !isNumberValid ? "text-red-600" : "text-gray-500"}`}>
            {fssaiNumber.length}/14 digits
          </p>
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">
            Valid up to
          </label>
          <input
            type="date"
            value={fssaiExpiry}
            onChange={(e) => setFssaiExpiry(e.target.value)}
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-black focus:border-black"
          />
        </div>

        <div className="space-y-2">
          <label className="block text-xs font-medium text-gray-700">
            Upload your FSSAI license
          </label>
          <div
            onClick={handleFileClick}
            className="w-full rounded-xl border border-dashed border-gray-300 bg-gray-50 px-4 py-8 flex flex-col items-center justify-center text-center cursor-pointer hover:bg-gray-100 transition-colors"
          >
            {uploadedFile || existingImageUrl ? (
              <div className="space-y-2">
                <div className="text-2xl">✅</div>
                <p className="text-sm font-medium text-gray-900">
                  {uploadedFile ? uploadedFile.name : "License already uploaded"}
                </p>
                <p className="text-xs text-gray-500">Click to change</p>
              </div>
            ) : (
              <>
                <div className="mb-2 text-2xl">⬆️</div>
                <p className="text-sm font-medium text-gray-900 mb-1">
                  Upload your FSSAI license
                </p>
                <p className="text-xs text-gray-500">
                  jpeg, png, or pdf (up to 5MB)
                </p>
              </>
            )}
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              onChange={(e) => handleFileSelect(e.target.files?.[0])}
              accept="image/*,application/pdf"
            />
          </div>
        </div>
      </form>

      {/* Bottom button */}
      <div className="px-4 pb-6 pt-2 border-t border-gray-200 bg-white">
        <button
          type="submit"
          form="fssai-form"
          className={`w-full py-3 rounded-full text-sm font-medium transition-colors ${
            canSubmit
              ? "bg-black text-white hover:bg-gray-900"
              : "bg-gray-200 text-gray-500 cursor-not-allowed"
          }`}
          disabled={!canSubmit}
        >
          {submitting ? "Saving..." : "Confirm"}
        </button>
      </div>

      <ImageSourcePicker
        isOpen={isPhotoPickerOpen}
        onClose={() => setIsPhotoPickerOpen(false)}
        onFileSelect={handleFileSelect}
        title="Upload FSSAI License"
        description="Choose how to upload your FSSAI license"
        fileNamePrefix="fssai-license"
        galleryInputRef={fileInputRef}
      />
    </div>
  )
}
