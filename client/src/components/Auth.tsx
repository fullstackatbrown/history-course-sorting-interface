import GoogleButton from 'react-google-button'
import React, { useEffect, useState } from "react";
import { IUser } from '../types';

function Auth() {

  const [user, setUser] = useState<IUser>();
  const [, setError] = useState("");
  // const [loading, setLoading] = useState(true);

  // called once when components on page have rendered
  useEffect(() => {
      async function getUser() {
          await fetchUser(setUser, setError);
          // setLoading(false);
      }
      getUser();
  }, []);

  // fetches the user if the user is logged in on the backend
  async function fetchUser(
    setUser: (user: IUser) => void,
    setError: (error: string) => void
  ) {
    try {
        const res = await fetch(
            `${process.env.REACT_APP_SERVER_URL}/auth/login/success`,
            {
                method: "GET",
                credentials: "include",
                headers: {
                    Accept: "application/json",
                    "Content-Type": "application/json",
                    "Access-Control-Allow-Credentials": "true",
                },
            }
        );
        // if the user is logged in, set the user and authenticated flag
        if (res.status === 200) {
            const resJson = await res.json();
            setUser(resJson.user);
        } else {
            throw new Error("failed to authenticate user");
        }
    } catch (error) {
        setError("Failed to authenticate user");
    }
  } 

  // checks if the user is authenticated (probably just going to be used for test purposes)
  async function checkAuth() {
    try {
        const res = await fetch(
            `${process.env.REACT_APP_SERVER_URL}/auth/check-auth`,
            {
                method: "GET",
                credentials: "include",
                headers: {
                    Accept: "application/json",
                    "Content-Type": "application/json",
                    "Access-Control-Allow-Credentials": "true",
                },
            }
        );

        if (res.status === 200) {
            const resJson = await res.json();
            console.log(resJson.user);
        } else {
            throw new Error("user is not authenticated");
        }
    } catch (error) {
        console.error(error);
    }
  }

  const handleLoginClick = () => {
    window.open(`${process.env.REACT_APP_SERVER_URL}/auth/google`, "_self");
  }
  return (
    <div>
      <GoogleButton onClick={handleLoginClick}/>
      {/* <button onClick={checkAuth}>Check Auth</button> */}
      <p>User: {user?.displayName}</p>
    </div>
  );
}

export default Auth;