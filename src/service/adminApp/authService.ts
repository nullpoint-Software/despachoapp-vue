import type { AxiosInstance } from "axios";
import axios, { AxiosError } from "axios";
import { useRoute, useRouter } from "vue-router";
class authService {
  private serverip: string;
  private axios: AxiosInstance;
  public authStatus: boolean = false;

  constructor(serverip: string, axios: AxiosInstance) {
    this.serverip = serverip;
    this.axios = axios;
  }

  async loginUser(credentials: { username: string; password: string }) {
    try {
      const response = await this.axios.post(
        `${this.serverip}/login`,
        credentials
      );

      localStorage.setItem("token", response.data.token); // Store JWT token
      localStorage.setItem("fullname", response.data.fullName);
      localStorage.setItem("username", response.data.username);
      localStorage.setItem("userid", response.data.userid);

      localStorage.setItem("level", response.data.level);
      const base64Image = response.data.userphoto;
      // const imageFile = base64ToFile(base64Image, 'profile-photo.png');
      // const imageUrl = URL.createObjectURL(imageFile); // Create a URL for the image blob

      localStorage.setItem(
        "userphoto",
        "data:image/png;base64," + response.data.userphoto
      );
      return true;
    } catch (error) {
      console.error(error);
      return false;
    }
  }

  getUserInfo = async () => {
    try {
      const response = await axios.get(`${this.serverip}/usuario`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
      });
      localStorage.setItem("fullname", response.data.fullName);
      localStorage.setItem("username", response.data.username);
      localStorage.setItem("userid", response.data.userid);

      localStorage.setItem("level", response.data.level);
      localStorage.setItem(
        "userphoto",
        "data:image/png;base64," + response.data.userphoto
      );
      return true;
    } catch (error) {
      console.error(error);
      return false;
    }
  };

  checkAuthRedirect = async (isLogin: boolean) => {
    const router = useRouter();
    const currentRoute = useRoute();

    // Check if the token exists in localStorage
    const token = await localStorage.getItem("token");
    if (!isLogin) {
      if (!(await this.getUserInfo())) {
        localStorage.clear();
        await router.push({ path: "/login", query: { error: "server" } });
        this.authStatus = false;
        return;
      }
    }
    if (isLogin) {
      if (!(await this.getUserInfo())) {
        localStorage.clear();
        await router.push({ path: "/login", query: { error: "token" } });
        this.authStatus = false;
        return;
      }
    }

    if (!token) {
      // If the token doesn't exist, redirect to /login
      localStorage.clear();
      await router.push("/login");
      this.authStatus = false;
    } else if (token && currentRoute.path === "/login") {
      await router.push("/app");
      this.authStatus = true;
    }
  };
}

export function base64ToFile(
  base64String: string,
  filename: string,
  mimeType: string = "image/png"
): Blob {
  // Clean the base64 string to remove any whitespace characters
  const cleanedBase64String = base64String.replace(/\s+/g, ""); // Remove all spaces, newlines, etc.

  // Split the base64 string into the MIME part and the actual base64 data
  const arr = cleanedBase64String.split(",");

  // Default to 'image/png' if no MIME type is provided
  let mime = mimeType;

  // If the base64 string has a MIME prefix, extract it
  if (arr.length > 1) {
    const mimeMatch = arr[0].match(/:(.*?);/);
    if (mimeMatch) {
      mime = mimeMatch[1]; // Extract MIME type from the base64 string
    }
  }

  try {
    // Decode the base64 string (after the comma)
    const byteCharacters = atob(arr[arr.length - 1]); // Decode base64 string
    const byteArrays: Uint8Array[] = [];

    // Convert the decoded string to a byte array
    for (let offset = 0; offset < byteCharacters.length; offset += 1024) {
      const slice = byteCharacters.slice(offset, offset + 1024);
      const byteNumbers = new Array(slice.length);

      for (let i = 0; i < slice.length; i++) {
        byteNumbers[i] = slice.charCodeAt(i);
      }

      const byteArray = new Uint8Array(byteNumbers);
      byteArrays.push(byteArray);
    }

    return new Blob(byteArrays, { type: mime });
  } catch (error: any) {
    throw new Error(`Invalid base64 string: ${error.message}`);
  }
}

export default authService;
