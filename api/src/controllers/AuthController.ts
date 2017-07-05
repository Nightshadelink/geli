import {Request} from 'express';
import {Body, Post, JsonController, Req, HttpError, UseBefore, BodyParam, ForbiddenError} from 'routing-controllers';
import {json as bodyParserJson} from 'body-parser';
import passportLoginMiddleware from '../security/passportLoginMiddleware';
import emailService from '../services/EmailService';
import {IUser} from '../../../shared/models/IUser';
import {IUserModel, User} from '../models/User';
import {JwtUtils} from '../security/JwtUtils';

@JsonController('/auth')
export class AuthController {

  @Post('/login')
  @UseBefore(bodyParserJson(), passportLoginMiddleware) // We need body-parser for passport to find the credentials
  postLogin(@Req() request: Request) {
    const user = <IUserModel>(<any>request).user;

    return {
      token: 'JWT ' + JwtUtils.generateToken(user),
      user: user.toObject()
    };
  }

  @Post('/register')
  postRegister(@Body() user: IUser) {
    return User.findOne({email: user.email})
      .then((existingUser) => {
        // If user is not unique, return error
        if (existingUser) {
          throw new HttpError(422, 'That email address is already in use.');
        }

        const newUser = new User(user);

        return newUser.save();
      })
      .then((savedUser) => {
        emailService.sendActivation(savedUser);

        return {success: true};
      });
  }

  // TODO If activate user and is in playlist add to course.
  @Post('/activate')
  postActivation(@BodyParam('authenticationToken') authenticationToken: string) {
    return User.findOne({authenticationToken: authenticationToken})
      .then((existingUser) => {
        if (!existingUser) {
          throw new HttpError(422, 'could not activate user');
        }

        existingUser.authenticationToken = undefined;
        existingUser.isActive = true;
        return existingUser.save();
      })
      .then((user) => {
        return {success: true};
      });
  }

  @Post('/reset')
  postPasswordReset(@BodyParam('resetPasswordToken') resetPasswordToken: string, @BodyParam('newPassword') newPassword: string) {
    return User.findOne({resetPasswordToken: resetPasswordToken})
      .then((existingUser) => {
        if (!existingUser) {
          throw new HttpError(422, 'could not reset users password');
        }
        if (existingUser.resetPasswordExpires < new Date()) {
          throw new ForbiddenError('your reset password token is expired');
        }

        existingUser.password = newPassword;
        existingUser.resetPasswordToken = undefined;
        existingUser.resetPasswordExpires = undefined;
        existingUser.markModified('password');
        return existingUser.save();
      })
      .then((savedUser) => {

        return {success: true};
      });
  }

  @Post('/requestreset')
  postRequestPasswordReset(@BodyParam('email') email: string) {
    return User.findOne({email: email})
      .then((existingUser) => {
        if (!existingUser) {
          throw new HttpError(422, 'could not reset users password');
        }

        const expires = new Date();
        expires.setTime((new Date()).getTime()
          // Add 24h
          + (24 * 60 * 60 * 1000));

        existingUser.resetPasswordExpires = expires;
        return existingUser.save();
      })
      .then((user) => {
        emailService.sendPasswordReset(user);

        return {success: true};
      });
  }
}
