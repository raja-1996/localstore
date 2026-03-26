from pydantic import BaseModel


class UploadResponse(BaseModel):
    path: str
    url: str


class DownloadResponse(BaseModel):
    url: str
