from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class DoctorProfileSubmitRequest(BaseModel):
    clinic_name: str = Field(min_length=1, max_length=255)
    specialization: str = Field(default="Gynecologist", min_length=1, max_length=255)
    city: str = Field(min_length=1, max_length=255)
    address: str = Field(min_length=1, max_length=1000)
    phone: str = Field(min_length=1, max_length=50)
    years_experience: int | None = Field(default=None, ge=0, le=80)
    consultation_hours: str = Field(
        default="Mon–Sat, 10 AM – 6 PM", max_length=255
    )
    about: str = Field(default="", max_length=5000)
    photo_url: str = Field(default="", max_length=2000)
    medical_reg_no: str | None = Field(default=None, max_length=100)
    qualification: str | None = Field(default=None, max_length=255)
    consultation_fee: int | None = Field(default=None, ge=0)


class DoctorDirectoryEntry(BaseModel):
    id: int
    user_id: int
    full_name: str
    specialization: str
    clinic_name: str
    city: str
    address: str
    phone: str
    years_experience: int | None = None
    consultation_hours: str
    about: str | None
    photo_url: str | None
    medical_reg_no: str | None = None
    qualification: str | None = None
    consultation_fee: int | None = None


class DoctorProfileResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    user_id: int
    clinic_name: str
    specialization: str
    city: str
    address: str
    phone: str
    years_experience: int | None = None
    consultation_hours: str
    about: str | None
    photo_url: str | None
    medical_reg_no: str | None = None
    qualification: str | None = None
    consultation_fee: int | None = None
    updated_at: datetime | None
